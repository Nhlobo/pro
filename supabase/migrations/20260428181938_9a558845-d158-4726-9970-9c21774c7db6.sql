REVOKE EXECUTE ON FUNCTION public.get_consultant_period_stats(DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_consultant_monthly_stats(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_consultant_period_stats(DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_consultant_monthly_stats(INTEGER, INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.issue_monthly_sales_strikes(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_monthly_sales_strikes(DATE) TO service_role;