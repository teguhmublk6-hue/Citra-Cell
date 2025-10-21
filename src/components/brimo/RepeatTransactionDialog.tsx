
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

interface RepeatTransactionDialogProps {
    isOpen: boolean;
    onYes: () => void;
    onNo: () => void;
}

export default function RepeatTransactionDialog({ isOpen, onYes, onNo }: RepeatTransactionDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onNo()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Transaksi Berhasil!</AlertDialogTitle>
                    <AlertDialogDescription>
                        Apakah Anda ingin mencatat transaksi serupa lagi?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onNo}>Tidak, Selesai</AlertDialogCancel>
                    <AlertDialogAction onClick={onYes}>
                        Ya, Catat Lagi
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
