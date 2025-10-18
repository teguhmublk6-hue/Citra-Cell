
"use client";

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { KasAccount } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import KasAccountForm from './KasAccountForm';
import DeleteKasAccountDialog from './DeleteKasAccountDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function KasManagement() {
  const firestore = useFirestore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<KasAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<KasAccount | null>(null);

  const kasAccountsCollection = useMemoFirebase(() => {
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts, isLoading } = useCollection<KasAccount>(kasAccountsCollection);

  const handleAdd = () => {
    setSelectedAccount(null);
    setIsFormOpen(true);
  };

  const handleEdit = (account: KasAccount) => {
    setSelectedAccount(account);
    setIsFormOpen(true);
  };

  const handleDelete = (account: KasAccount) => {
    setAccountToDelete(account);
    setIsDialogOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) {
      const docRef = doc(firestore, 'kasAccounts', accountToDelete.id);
      deleteDocumentNonBlocking(docRef);
    }
    setIsDialogOpen(false);
    setAccountToDelete(null);
  };
  
  if (isFormOpen) {
    return <KasAccountForm account={selectedAccount} onDone={() => setIsFormOpen(false)} />;
  }

  return (
    <div className="py-4 h-full flex flex-col">
        <Button onClick={handleAdd} className="mb-4">
            <Plus size={16} className="mr-2" />
            Tambah Akun Kas
        </Button>
        <ScrollArea className="flex-1">
          {isLoading && (
            <div className="space-y-3 pr-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
          )}
          <div className="space-y-3 pr-4">
            {kasAccounts?.map((account) => {
              const isBelowMinimum = account.balance < account.minimumBalance;
              return (
                <div key={account.id} className="flex items-center justify-between p-3 bg-card-foreground/5 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                        <p className="font-semibold">{account.label}</p>
                        {account.type && <p className="text-xs text-muted-foreground">({account.type})</p>}
                    </div>
                    <p className={cn("text-sm", isBelowMinimum ? "text-red-500" : "text-muted-foreground")}>
                      Rp{account.balance.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(account)}>
                      <Edit size={18} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(account)}>
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <DeleteKasAccountDialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onConfirm={confirmDelete}
            accountName={accountToDelete?.label}
        />
    </div>
  );
}
