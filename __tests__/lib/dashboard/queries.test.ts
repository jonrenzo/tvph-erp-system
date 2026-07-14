import { getDashboardFinancials, getProjectProgress } from '@/lib/dashboard/queries';

jest.mock('server-only', () => ({}));

describe('dashboard query adapters', () => {
  it('maps financial RPC values and monthly trends', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        total_po_commitment: '1200', total_paid: '300', total_invoiced: '900',
        ap_paid_this_month: '100', ap_overdue: '25', ar_collected_this_month: '50',
        ar_outstanding: '400', ar_overdue: '10', client_total_paid: '600',
        monthly_trends: [{ month: 'Jan', ap_paid: '10', ar_collected: '20' }],
      },
      error: null,
    });

    await expect(getDashboardFinancials({ rpc } as any, '2026-07-14')).resolves.toEqual({
      totalPOCommitment: 1200, totalPaid: 300, totalInvoiced: 900,
      apPaidThisMonth: 100, apOverdue: 25, arCollectedThisMonth: 50,
      arOutstanding: 400, arOverdue: 10, clientTotalPaid: 600,
      monthlyTrends: [{ month: 'Jan', apPaid: 10, arCollected: 20 }],
    });
    expect(rpc).toHaveBeenCalledWith('get_dashboard_financials', { p_today: '2026-07-14' });
  });

  it('maps project progress rows returned by the database', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{
        id: 'project-1', name: 'Project', paid_amount: '50', committed_amount: '100', pct: 50,
        total_invoiced: '60', total_dp_amount: '10', billing_pct: 70, completion_pct: 80, variance: 10,
      }],
      error: null,
    });

    await expect(getProjectProgress({ rpc } as any)).resolves.toEqual([{
      id: 'project-1', name: 'Project', paidAmount: 50, committedAmount: 100, pct: 50,
      totalInvoiced: 60, totalDpAmount: 10, billingPct: 70, completionPct: 80, variance: 10,
    }]);
    expect(rpc).toHaveBeenCalledWith('get_dashboard_project_progress');
  });
});
