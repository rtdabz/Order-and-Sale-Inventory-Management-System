<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItems;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\Sales;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Requests\UpdateOrderRequest;
use App\Services\TransactionNumberService;
use Illuminate\Support\Facades\DB;

/**
 * Orders are POS transactions.
 *
 * The system runs on a single till, so a checkout is final: the order, its
 * items, the stock deduction and the sale record are all written in one
 * transaction. There is no pending queue and no per-PC ordering.
 */
class OrderController extends Controller
{
    public function index()
    {
        // The sale relation is loaded so the frontend can show revenue totals.
        $orders = Order::with(['orderItems.product', 'sale'])->orderBy('id', 'desc')->get();
        return response()->json($orders);
    }

    /**
     * POST /api/orders
     *
     * Records a completed POS sale: deducts stock (resolving bundles into their
     * components), writes the order items, then creates the linked Sale.
     */
    public function store(StoreOrderRequest $request)
    {
        $validated = $request->validated();

        DB::beginTransaction();
        try {
            $order = Order::create([
                'order_date' => $validated['order_date'],
                'total_amount' => 0,
            ]);

            $total = 0;

            foreach ($validated['order_items'] as $item) {
                $product = Product::with('bundleItems.bundledProduct')->find($item['product_id']);
                if (!$product) {
                    throw new \Exception("Product with ID {$item['product_id']} not found.");
                }

                $isBundle = $product->bundleItems && $product->bundleItems->isNotEmpty();

                if ($isBundle) {
                    // Bundles hold no stock of their own — draw down each component.
                    foreach ($product->bundleItems as $bundleItem) {
                        $bundledProduct = $bundleItem->bundledProduct;
                        if (!$bundledProduct->is_stockable) {
                            continue;
                        }

                        $neededQuantity = $bundleItem->quantity * $item['quantity'];
                        $this->deductStock($bundledProduct, $neededQuantity, true);
                    }
                } elseif ($product->is_stockable) {
                    $this->deductStock($product, $item['quantity'], false);
                }

                $price = $item['price'] ?? $product->price;

                OrderItems::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'category_id' => $item['category_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'price' => $price,
                    'notes' => $item['notes'] ?? null,
                    'cooking_preferences' => $item['cookingPreferences'] ?? null,
                ]);

                $total += $price * $item['quantity'];
            }

            $order->update([
                'total_amount' => $total,
                'transaction_number' => TransactionNumberService::generate(),
            ]);

            // The checkout is the completion, so the sale is booked immediately.
            Sales::create([
                'sale_date' => $order->order_date,
                'total_amount' => $total,
                'total_order' => 1,
                'order_id' => $order->id,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Sale recorded successfully and stock updated!',
                'data' => $order->fresh()->load(['orderItems.product', 'sale']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Draw `$quantity` units out of a product's inventory rows, oldest first.
     *
     * @throws \Exception when the product has no inventory or insufficient stock
     */
    private function deductStock(Product $product, int $quantity, bool $isBundleComponent): void
    {
        $label = $isBundleComponent
            ? "{$product->product_name} (bundle component)"
            : $product->product_name;

        $inventories = Inventory::where('product_id', $product->id)->orderBy('id', 'asc')->get();
        if ($inventories->isEmpty()) {
            throw new \Exception("No inventory record found for product: {$label}");
        }

        $available = $inventories->sum('quantity');
        if ($available < $quantity) {
            throw new \Exception("Not enough stock for {$label}. Available: {$available}, Needed: {$quantity}");
        }

        $remaining = $quantity;
        foreach ($inventories as $inventory) {
            if ($remaining <= 0) {
                break;
            }
            $take = min($inventory->quantity, $remaining);
            $inventory->quantity -= $take;
            $inventory->save();
            $remaining -= $take;
        }
    }

    public function show($id)
    {
        $order = Order::with(['orderItems.product', 'sale'])->find($id);

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return response()->json($order);
    }

    /**
     * GET /api/orders/completed
     *
     * Every POS checkout produces a sale, so this is the transaction history.
     */
    public function completed()
    {
        $orders = Order::with(['orderItems.product', 'sale'])
            ->whereHas('sale')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json($orders);
    }

    // PUT /api/orders/{id}
    public function update(UpdateOrderRequest $request, $id)
    {
        $order = Order::findOrFail($id);
        $order->update($request->validated());

        return response()->json([
            'message' => 'Order updated successfully',
            'data' => $order->load('orderItems.product'),
        ]);
    }

    /**
     * PATCH /api/orders/{id}/cancel
     *
     * Voids a transaction: returns the stock, then removes the sale, the items
     * and the order itself.
     */
    public function cancel($id)
    {
        $order = Order::with('orderItems.product', 'sale')->findOrFail($id);

        DB::beginTransaction();
        try {
            // Returned stock is written as a new inventory row so the movement
            // stays visible in the inventory report.
            foreach ($order->orderItems as $item) {
                Inventory::create([
                    'product_id' => $item->product_id,
                    'quantity' => $item->quantity,
                    'type' => 'return',
                    'source' => 'order_cancelled',
                ]);
            }

            OrderItems::where('order_id', $order->id)->delete();
            Sales::where('order_id', $order->id)->delete();
            $order->delete();

            DB::commit();

            return response()->json([
                'message' => 'Transaction voided successfully and stock restored',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
}
