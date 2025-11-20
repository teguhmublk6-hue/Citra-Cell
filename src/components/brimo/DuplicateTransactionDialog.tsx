
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DuplicateTransactionDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function DuplicateTransactionDialog({ isOpen, onConfirm, onCancel }: DuplicateTransactionDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Transaksi Serupa Ditemukan</AlertDialogTitle>
                    <AlertDialogDescription>
                        Ditemukan transaksi dengan detail serupa (nama, jumlah, dan akun) pada hari ini. 
                        Apakah Anda yakin ingin tetap menyimpan transaksi ini?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>Tidak, Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        Ya, Simpan Saja
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

