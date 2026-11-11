import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

load_dotenv("d:/PayPal/DelTix/.env")
db_url = os.getenv("SUPABASE_DB_URL")

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

print("Connected to Supabase PostgreSQL.")
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
tables = [r[0] for r in cur.fetchall()]
print("Current public tables:", tables)

# Read 001_initial_schema.sql
sql_001 = Path("d:/PayPal/DelTix/backend/shared/migrations/001_initial_schema.sql").read_text(encoding="utf-8")
print("\nApplying 001_initial_schema.sql...")
try:
    cur.execute(sql_001)
    print("001_initial_schema.sql applied successfully!")
except Exception as e:
    print("Error applying 001:", e)

# Read 002_pgvector_rag_schema.sql
sql_002_path = Path("d:/PayPal/DelTix/backend/shared/migrations/002_pgvector_rag_schema.sql")
if sql_002_path.exists():
    sql_002 = sql_002_path.read_text(encoding="utf-8")
    print("\nApplying 002_pgvector_rag_schema.sql...")
    try:
        cur.execute(sql_002)
        print("002_pgvector_rag_schema.sql applied successfully!")
    except Exception as e:
        print("Error applying 002:", e)

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
tables_after = [r[0] for r in cur.fetchall()]
print("\nFinal public tables in database:", tables_after)

# Seed default capabilities if capability_registry is empty
cur.execute("SELECT COUNT(*) FROM capability_registry;")
cap_count = cur.fetchone()[0]
print("Capability registry count:", cap_count)

if cap_count == 0:
    print("Seeding core PayPal capabilities into capability_registry...")
    seed_sql = """
    INSERT INTO capability_registry (
        capability_id, version, description, http_method, endpoint_path,
        parameters_schema, output_schema, is_sensitive, is_mutation,
        idempotent, timeout_seconds, max_retries, required_permissions, status
    ) VALUES 
    (
        'paypal.invoice.create', '1.0.0', 'Create a new invoice in PayPal sandbox',
        'POST', '/v2/invoicing/invoices',
        '{"type": "object", "properties": {"amount": {"type": "number"}, "currency": {"type": "string"}, "recipient_email": {"type": "string"}}, "required": ["amount", "recipient_email"]}'::jsonb,
        '{"type": "object", "properties": {"invoice_id": {"type": "string"}, "status": {"type": "string"}}}'::jsonb,
        true, true, false, 15, 3, ARRAY['INVOICE_CREATE'], 'ACTIVE'
    ),
    (
        'paypal.payment.refund', '1.0.0', 'Issue a refund for a captured payment',
        'POST', '/v2/payments/captures/{capture_id}/refund',
        '{"type": "object", "properties": {"capture_id": {"type": "string"}, "amount": {"type": "number"}, "reason": {"type": "string"}}, "required": ["capture_id"]}'::jsonb,
        '{"type": "object", "properties": {"refund_id": {"type": "string"}, "status": {"type": "string"}}}'::jsonb,
        true, true, true, 20, 2, ARRAY['PAYMENT_REFUND'], 'ACTIVE'
    ),
    (
        'paypal.transaction.search', '1.0.0', 'Search transaction history in PayPal sandbox',
        'GET', '/v1/reporting/transactions',
        '{"type": "object", "properties": {"start_date": {"type": "string"}, "end_date": {"type": "string"}}, "required": ["start_date"]}'::jsonb,
        '{"type": "object", "properties": {"transaction_details": {"type": "array"}}}'::jsonb,
        false, false, true, 10, 3, ARRAY['TRANSACTION_READ'], 'ACTIVE'
    )
    ON CONFLICT (capability_id, version) DO NOTHING;
    """
    cur.execute(seed_sql)
    print("Core PayPal capabilities seeded successfully!")

# Ensure dev tenant exists
cur.execute("""
INSERT INTO tenants (tenant_id, name, status) 
VALUES ('ten_dev_workspace', 'Developer Workspace', 'ACTIVE')
ON CONFLICT (tenant_id) DO NOTHING;
""")
print("Dev tenant verified.")

conn.close()
