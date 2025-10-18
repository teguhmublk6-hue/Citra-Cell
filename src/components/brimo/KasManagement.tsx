
"use client";

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { KasAccount } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, ShieldAlert } from 'lucide-react';
import KasAccountForm from './KasAccountForm';
import DeleteKasAccountDialog from './DeleteKasAccountDialog';
import DeleteAllKasAccountsDialog from './DeleteAllKasAccountsDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function KasManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
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
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) {
      const docRef = doc(firestore, 'kasAccounts', accountToDelete.id);
      deleteDocumentNonBlocking(docRef);
    }
    setIsDeleteDialogOpen(false);
    setAccountToDelete(null);
  };

  const confirmResetAll = async () => {
    if (!firestore || !kasAccounts || kasAccounts.length === 0) {
        toast({
            variant: "destructive",
            title: "Tidak Ada Akun",
            description: "Tidak ada akun kas untuk direset.",
        });
        setIsDeleteAllDialogOpen(false);
        return;
    }

    toast({
        title: "Memproses...",
        description: "Mereset saldo dan riwayat transaksi semua akun.",
    });

    try {
        for (const account of kasAccounts) {
            const accountRef = doc(firestore, 'kasAccounts', account.id);
            const transactionsRef = collection(accountRef, 'transactions');
            
            // Get all transactions to delete them in a batch
            const transactionsSnapshot = await getDocs(transactionsRef);
            
            const batch = writeBatch(firestore);

            // Reset account balance
            batch.update(accountRef, { balance: 0 });

            // Delete all transactions in the subcollection
            transactionsSnapshot.forEach(transactionDoc => {
                batch.delete(transactionDoc.ref);
            });

            await batch.commit();
        }
        
        toast({
            title: "Berhasil",
            description: "Semua saldo akun telah direset dan riwayat transaksi dihapus.",
        });

    } catch (e) {
        console.error("Error resetting all accounts: ", e);
        toast({
            variant: "destructive",
            title: "Gagal Mereset",
            description: "Terjadi kesalahan saat mereset semua akun.",
        });
    } finally {
        setIsDeleteAllDialogOpen(false);
    }
  };
  
  if (isFormOpen) {
    return <KasAccountForm account={selectedAccount} onDone={() => setIsFormOpen(false)} />;
  }

  return (
    <div className="py-4 h-full flex flex-col">
        <div className="space-y-2 mb-4">
            <Button onClick={handleAdd} className="w-full">
                <Plus size={16} className="mr-2" />
                Tambah Akun Kas
            </Button>
             <Button variant="destructive" onClick={() => setIsDeleteAllDialogOpen(true)} className="w-full">
                <ShieldAlert size={16} className="mr-2" />
                Reset Semua Akun
            </Button>
        </div>
        <p className="px-1 text-sm font-semibold mb-2 text-muted-foreground">Daftar Akun</p>
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
             {!isLoading && kasAccounts && kasAccounts.length === 0 && (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">Belum ada akun kas.</p>
                </div>
            )}
          </div>
        </ScrollArea>
        <DeleteKasAccountDialog
            isOpen={isDeleteDialogOpen}
            onClose={() => setIsDeleteDialogOpen(false)}
            onConfirm={confirmDelete}
            accountName={accountToDelete?.label}
        />
        <DeleteAllKasAccountsDialog
            isOpen={isDeleteAllDialogOpen}
            onClose={() => setIsDeleteAllDialogOpen(false)}
            onConfirm={confirmResetAll}
        />
    </div>
  );
}

    