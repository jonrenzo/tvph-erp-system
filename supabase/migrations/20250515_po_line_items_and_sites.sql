-- ============================================================================
-- PO Line Items & Site Details tables
-- Supports multi-row items on Page 1 and multi-row sites on Page 3
-- ============================================================================

-- 1. po_line_items — each row in the PO items table (Page 1)
CREATE TABLE IF NOT EXISTS public.po_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_no     INTEGER NOT NULL,
  item_code   TEXT DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  qty         NUMERIC NOT NULL DEFAULT 1,
  uom         TEXT NOT NULL DEFAULT 'LOT',
  unit_price  NUMERIC NOT NULL DEFAULT 0,
  amount      NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON public.po_line_items;
CREATE POLICY "Allow authenticated full access" ON public.po_line_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON public.po_line_items(po_id);

-- 2. po_site_details — each row in the sites summary table (Page 3)
CREATE TABLE IF NOT EXISTS public.po_site_details (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  sn          INTEGER NOT NULL,
  region      TEXT NOT NULL DEFAULT '',
  area_city   TEXT NOT NULL DEFAULT '',
  no_of_nodes INTEGER NOT NULL DEFAULT 0,
  cable_length_km NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.po_site_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON public.po_site_details;
CREATE POLICY "Allow authenticated full access" ON public.po_site_details
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_po_site_details_po_id ON public.po_site_details(po_id);
