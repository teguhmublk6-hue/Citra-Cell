
"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";

interface AdminPasscodeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CORRECT_PASSCODE = "citra2malaka";

export default function AdminPasscodeDialog({ isOpen, onClose, onSuccess }: AdminPasscodeDialogProps) {
    const [inputValue, setInputValue] = useState("");
    const { toast } = useToast();

    const handleConfirm = () => {
        if (inputValue === CORRECT_PASSCODE) {
            onSuccess();
        } else {
            toast({
                variant: "destructive",
                title: "Kode Salah",
                description: "Kode yang Anda masukkan tidak benar.",
            });
            setInputValue("");
        }
    }
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          handleConfirm();
        }
    };

    const handleClose = () => {
        setInputValue("");
        onClose();
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={handleClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Akses Terbatas</AlertDialogTitle>
                    <AlertDialogDescription>
                        Halaman ini hanya untuk admin. Silakan masukkan kode sandi untuk melanjutkan.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="passcode">Kode Sandi</Label>
                    <Input 
                        id="passcode"
                        type="password"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Masukkan kode..."
                        autoComplete="off"
                        autoCorrect="off"
                    />
                </div>
                <AlertDialogFooter>
                    <Button variant="outline" onClick={handleClose}>Batal</Button>
                    <Button onClick={handleConfirm}>
                        Masuk
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
