import QuickServices from './quick-services';
import RecentTransactions from './recent-transactions';

export default function HomeContent() {
  return (
    <div className="flex flex-col gap-4 px-4">
      <QuickServices />
      <RecentTransactions />
    </div>
  );
}
