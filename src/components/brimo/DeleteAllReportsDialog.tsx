

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

interface DeleteAllReportsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    confirmationKeyword?: string;
}

const DEFAULT_TITLE = "Apakah Anda Benar-Benar Yakin?";
const DEFAULT_DESCRIPTION = "Tindakan ini akan menghapus SEMUA riwayat laporan (Laba/Rugi, Pembukuan Harian, dll) secara permanen. Ini tidak akan mempengaruhi saldo akun kas Anda, tetapi semua catatan transaksi layanan akan hilang. Tindakan ini tidak dapat diurungkan.";
const DEFAULT_KEYWORD = "HAPUS LAPORAN";

export default function DeleteAllReportsDialog({ 
    isOpen, 
    onClose, 
    onConfirm,
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    confirmationKeyword = DEFAULT_KEYWORD,
}: DeleteAllReportsDialogProps) {
    const [inputValue, setInputValue] = useState("");
    const isConfirmed = inputValue.toUpperCase() === confirmationKeyword.toUpperCase();

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
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="confirmation">Untuk mengonfirmasi, ketik <strong className="text-destructive">{confirmationKeyword}</strong> di bawah ini.</Label>
                    <Input 
                        id="confirmation"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={confirmationKeyword}
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
                        Ya, Hapus
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

