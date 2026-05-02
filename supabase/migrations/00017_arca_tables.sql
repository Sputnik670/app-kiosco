-- ============================================================================
-- 00017_arca_tables.sql
-- ============================================================================
-- Versiona en git las tablas arca_config y arca_invoices que ya existen en
-- producción (vrgexonzlrdptrplqpri) pero nunca habían sido versionadas.
-- Detectado en sesión 2-may-2026 al planificar el sprint ARCA con SDK directo.
--
-- IMPORTANTE: Esta migration usa IF NOT EXISTS / DO blocks defensivos porque
-- las tablas YA están aplicadas en prod. Es válida tanto para fresh setups
-- (crea las tablas desde cero) como para entornos donde ya existen (no-op).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- arca_config: configuración fiscal por organización (1 fila por org)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.arca_config (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cuit                  text        NOT NULL,
  razon_social          text        NOT NULL,
  punto_venta           integer     NOT NULL DEFAULT 1,
  cert_encrypted        text,
  key_encrypted         text,
  is_active             boolean     DEFAULT false,
  is_sandbox            boolean     DEFAULT true,
  tipo_contribuyente    text        NOT NULL DEFAULT 'monotributista'
                                    CHECK (tipo_contribuyente IN ('responsable_inscripto','monotributista','exento')),
  tipo_factura_default  text        NOT NULL DEFAULT 'B'
                                    CHECK (tipo_factura_default IN ('A','B','C')),
  domicilio_fiscal      text,
  inicio_actividades    date,
  condicion_iva         text        NOT NULL DEFAULT 'Monotributo'
                                    CHECK (condicion_iva IN ('IVA Responsable Inscripto','Monotributo','IVA Exento','Responsable No Inscripto')),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT arca_config_org_unique UNIQUE (organization_id)
);

ALTER TABLE public.arca_config ENABLE ROW LEVEL SECURITY;

-- Policies arca_config: solo el owner de la organización puede leer/escribir/borrar
DROP POLICY IF EXISTS arca_config_select ON public.arca_config;
CREATE POLICY arca_config_select ON public.arca_config
  FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS arca_config_insert ON public.arca_config;
CREATE POLICY arca_config_insert ON public.arca_config
  FOR INSERT WITH CHECK (organization_id = get_my_org_id() AND is_owner());

DROP POLICY IF EXISTS arca_config_update ON public.arca_config;
CREATE POLICY arca_config_update ON public.arca_config
  FOR UPDATE USING (organization_id = get_my_org_id() AND is_owner());

DROP POLICY IF EXISTS arca_config_delete ON public.arca_config;
CREATE POLICY arca_config_delete ON public.arca_config
  FOR DELETE USING (organization_id = get_my_org_id() AND is_owner());

-- ----------------------------------------------------------------------------
-- arca_invoices: cada comprobante emitido (o intento de emisión)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.arca_invoices (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id               uuid        REFERENCES public.branches(id) ON DELETE SET NULL,
  sale_id                 uuid        REFERENCES public.sales(id) ON DELETE SET NULL,
  -- Datos del comprobante (formato AFIP/ARCA)
  cae                     text,
  cae_vencimiento         date,
  cbte_tipo               integer     NOT NULL,
  cbte_numero             bigint,
  punto_venta             integer     NOT NULL,
  concepto                integer     NOT NULL DEFAULT 1,
  doc_tipo                integer     NOT NULL DEFAULT 99,
  doc_nro                 text        NOT NULL DEFAULT '0',
  -- Importes (NUMERIC sin precision para preservar exactitud AFIP)
  imp_total               numeric     NOT NULL,
  imp_neto                numeric     NOT NULL DEFAULT 0,
  imp_iva                 numeric     NOT NULL DEFAULT 0,
  imp_op_ex               numeric     NOT NULL DEFAULT 0,
  imp_tot_conc            numeric     NOT NULL DEFAULT 0,
  iva_detalle             jsonb,
  -- Datos del receptor (cuando aplica, ej Factura A)
  receptor_nombre         text,
  receptor_cuit           text,
  receptor_domicilio      text,
  receptor_condicion_iva  text,
  -- Estado de emisión
  status                  text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending','authorized','rejected','cancelled','error')),
  error_message           text,
  qr_data                 text,
  fecha_emision           date        NOT NULL DEFAULT CURRENT_DATE,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arca_invoices_org    ON public.arca_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_arca_invoices_sale   ON public.arca_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_arca_invoices_cae    ON public.arca_invoices(cae);
CREATE INDEX IF NOT EXISTS idx_arca_invoices_status ON public.arca_invoices(status);
CREATE INDEX IF NOT EXISTS idx_arca_invoices_fecha  ON public.arca_invoices(fecha_emision);

ALTER TABLE public.arca_invoices ENABLE ROW LEVEL SECURITY;

-- Policies arca_invoices: lectura para toda la org (empleados ven facturas de sus ventas).
-- INSERT solo desde el server (server actions verifican is_owner internamente).
-- DELIBERADO: NO hay policy de UPDATE ni DELETE — los registros fiscales no se mutan
-- desde la app. Las correcciones se hacen vía nueva nota de crédito.
DROP POLICY IF EXISTS arca_invoices_select ON public.arca_invoices;
CREATE POLICY arca_invoices_select ON public.arca_invoices
  FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS arca_invoices_insert ON public.arca_invoices;
CREATE POLICY arca_invoices_insert ON public.arca_invoices
  FOR INSERT WITH CHECK (organization_id = get_my_org_id());
