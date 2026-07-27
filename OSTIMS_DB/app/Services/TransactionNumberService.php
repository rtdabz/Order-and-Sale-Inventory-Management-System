<?php

namespace App\Services;

use App\Models\Order;
use Carbon\Carbon;

class TransactionNumberService
{
    /**
     * Build a receipt number for a POS sale.
     *
     * Format: MMDDYY-SEQ##
     *   MMDDYY = date the sale was rung up (e.g. 072726 for 27 July 2026)
     *   SEQ##  = sequence within that calendar day, restarting at 01 each day
     *
     * The system runs on one till, so the number no longer carries a station
     * component.
     */
    public static function generate(): string
    {
        $now = Carbon::now();
        $sequence = str_pad((string) self::nextSequence($now), 2, '0', STR_PAD_LEFT);

        return "{$now->format('mdy')}-SEQ{$sequence}";
    }

    /**
     * Next sequence number for the given day.
     *
     * Counts orders already numbered today, so the value resets naturally at
     * midnight.
     */
    private static function nextSequence(Carbon $date): int
    {
        return Order::whereBetween('created_at', [
            $date->clone()->startOfDay(),
            $date->clone()->endOfDay(),
        ])
            ->whereNotNull('transaction_number')
            ->count() + 1;
    }
}
