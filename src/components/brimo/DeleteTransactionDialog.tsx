
"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteTransactionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    transactionName?: string;
}

const CONFIRMATION_KEYWORD = "HAPUS";

export default function DeleteTransactionDialog({ isOpen, onClose, onConfirm, transactionName }: DeleteTransactionDialogProps) {
    const [inputValue, setInputValue] = useState("");
    const isConfirmed = inputValue.toUpperCase() === CONFIRMATION_KEYWORD;

    const handleConfirm = () => {
        if (isConfirmed) {
            onConfirm();
            setInputValue("");
        }
    }

    const handleClose = () => {
        onClose();
        setInputValue("");
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={handleClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Transaksi Ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tindakan ini akan menghapus transaksi <strong>"{transactionName}"</strong> secara permanen dan <strong>mengembalikan saldo</strong> ke kondisi sebelum transaksi. Tindakan ini tidak dapat diurungkan.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="confirmation">Untuk mengonfirmasi, ketik <strong className="text-destructive">{CONFIRMATION_KEYWORD}</strong> di bawah ini.</Label>
                    <Input 
                        id="confirmation"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={CONFIRMATION_KEYWORD}
                        autoComplete="off"
                        autoCorrect="off"
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleClose}>Batal</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleConfirm} 
                        disabled={!isConfirmed}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-destructive/50"
                    >
                        Ya, Hapus Transaksi
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
