
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
import { Eye, EyeOff } from "lucide-react";

interface AdminPasscodeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CORRECT_PASSCODE = "citra2malaka";

export default function AdminPasscodeDialog({ isOpen, onClose, onSuccess }: AdminPasscodeDialogProps) {
    const [inputValue, setInputValue] = useState("");
    const [showPasscode, setShowPasscode] = useState(false);
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
        setShowPasscode(false);
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
                    <div className="relative">
                        <Input 
                            id="passcode"
                            type={showPasscode ? "text" : "password"}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Masukkan kode..."
                            autoComplete="off"
                            autoCorrect="off"
                            className="pr-10"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground"
                            onClick={() => setShowPasscode((prev) => !prev)}
                        >
                            {showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}
                        </Button>
                    </div>
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
