<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drops the per-PC ordering columns from `orders`.
 *
 * The POS now runs on a single till: sales are rung up at the terminal and
 * completed immediately, so orders no longer belong to a station
 * (`order_alias`) or to a customer browser session (`session_id`).
 *
 * WARNING: running this migration permanently discards the station label and
 * session id recorded against historical orders. Take a database backup first
 * if that history matters. Rolling back restores the columns but not the data.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'session_id')) {
                $table->dropColumn('session_id');
            }
            if (Schema::hasColumn('orders', 'order_alias')) {
                $table->dropColumn('order_alias');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'order_alias')) {
                $table->string('order_alias', 50)->nullable()->after('id');
            }
            if (!Schema::hasColumn('orders', 'session_id')) {
                $table->string('session_id', 64)->nullable()->after('order_alias');
            }
        });
    }
};
