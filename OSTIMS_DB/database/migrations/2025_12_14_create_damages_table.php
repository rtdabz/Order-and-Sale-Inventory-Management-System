<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('damages')) {
            Schema::create('damages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
                $table->integer('quantity');
                $table->decimal('cost_per_unit', 10, 2)->default(0);
                $table->text('reason')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasColumn('damages', 'action_taken')) {
            Schema::table('damages', function (Blueprint $table) {
                $table->string('action_taken')->nullable()->default('write_off')->after('reason');
                $table->text('notes')->nullable()->after('action_taken');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('damages');
    }
};
