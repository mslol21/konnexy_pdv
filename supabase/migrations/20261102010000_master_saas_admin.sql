CREATE TABLE IF NOT EXISTS public.platform_admins (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.master_list_companies()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'id',t.id,'name',t.name,'document',t.document,'plan',t.plan,
  'is_active',t.is_active,'created_at',t.created_at,
  'stores',(SELECT count(*) FROM public.stores s WHERE s.tenant_id=t.id)
 ) ORDER BY t.created_at DESC) FROM public.tenants t WHERE t.deleted_at IS NULL),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.master_create_company(p_name text,p_document text,p_plan text DEFAULT 'pro')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 IF length(trim(coalesce(p_name,'')))<2 OR length(trim(coalesce(p_document,'')))<5
  OR p_plan NOT IN ('free','pro','enterprise') THEN RAISE EXCEPTION 'invalid company fields'; END IF;
 INSERT INTO public.tenants(name,document,plan,is_active) VALUES(trim(p_name),trim(p_document),p_plan,true) RETURNING id INTO new_id;
 INSERT INTO public.stores(tenant_id,name,code) VALUES(new_id,'Loja Matriz','MATRIZ');
 RETURN new_id;
END $$;
CREATE OR REPLACE FUNCTION public.master_set_company_status(p_tenant_id uuid,p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 IF p_tenant_id IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'invalid parameters'; END IF;
 UPDATE public.tenants SET is_active=p_active,updated_at=now() WHERE id=p_tenant_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'company not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.master_list_companies() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.master_create_company(text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.master_set_company_status(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.master_list_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_create_company(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_set_company_status(uuid,boolean) TO authenticated;