import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, DollarSign, Calendar, CreditCard } from "lucide-react";
import { format, addMonths } from "date-fns";

export interface InstallmentPayment {
  method: string;
  amount: number;
}

export interface InstallmentDetail {
  number: number;
  amount: number;
  due_date: string;
  payments: InstallmentPayment[];
}

interface InstallmentsEditorProps {
  totalValue: number;
  installmentsCount: number;
  firstDueDate: string;
  value: InstallmentDetail[];
  onChange: (installments: InstallmentDetail[]) => void;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "cheque", label: "Cheque" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
];

const getMethodLabel = (value: string) => {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label || value;
};

export function InstallmentsEditor({
  totalValue,
  installmentsCount,
  firstDueDate,
  value,
  onChange,
}: InstallmentsEditorProps) {
  // Initialize installments when count or first due date changes
  useEffect(() => {
    if (installmentsCount > 0 && firstDueDate && value.length !== installmentsCount) {
      const baseAmount = Math.floor((totalValue / installmentsCount) * 100) / 100;
      const remainder = Math.round((totalValue - baseAmount * installmentsCount) * 100) / 100;
      
      const newInstallments: InstallmentDetail[] = [];
      for (let i = 0; i < installmentsCount; i++) {
        const dueDate = addMonths(new Date(firstDueDate), i);
        const amount = i === 0 ? baseAmount + remainder : baseAmount;
        newInstallments.push({
          number: i + 1,
          amount,
          due_date: format(dueDate, "yyyy-MM-dd"),
          payments: [{ method: "pix", amount }],
        });
      }
      onChange(newInstallments);
    }
  }, [installmentsCount, firstDueDate, totalValue]);

  const updateInstallment = (index: number, updates: Partial<InstallmentDetail>) => {
    const newInstallments = [...value];
    newInstallments[index] = { ...newInstallments[index], ...updates };
    onChange(newInstallments);
  };

  const addPaymentToInstallment = (installmentIndex: number) => {
    const installment = value[installmentIndex];
    const usedAmount = installment.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, installment.amount - usedAmount);
    
    const newPayments = [
      ...installment.payments,
      { method: "pix", amount: remaining },
    ];
    updateInstallment(installmentIndex, { payments: newPayments });
  };

  const removePaymentFromInstallment = (installmentIndex: number, paymentIndex: number) => {
    const installment = value[installmentIndex];
    if (installment.payments.length <= 1) return;
    
    const newPayments = installment.payments.filter((_, i) => i !== paymentIndex);
    updateInstallment(installmentIndex, { payments: newPayments });
  };

  const updatePayment = (
    installmentIndex: number,
    paymentIndex: number,
    updates: Partial<InstallmentPayment>
  ) => {
    const installment = value[installmentIndex];
    const newPayments = [...installment.payments];
    newPayments[paymentIndex] = { ...newPayments[paymentIndex], ...updates };
    updateInstallment(installmentIndex, { payments: newPayments });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const getTotalAllocated = (installment: InstallmentDetail) => {
    return installment.payments.reduce((sum, p) => sum + p.amount, 0);
  };

  if (value.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Configure o número de parcelas e a primeira data de vencimento para personalizar os pagamentos.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {value.map((installment, iIndex) => {
        const totalAllocated = getTotalAllocated(installment);
        const isBalanced = Math.abs(totalAllocated - installment.amount) < 0.01;
        
        return (
          <Card key={installment.number} className="border-muted">
            <CardContent className="p-3 space-y-2">
              {/* Installment Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {installment.number}ª parcela
                  </Badge>
                  <span className="text-sm font-medium">
                    {formatCurrency(installment.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="date"
                    value={installment.due_date}
                    onChange={(e) =>
                      updateInstallment(iIndex, { due_date: e.target.value })
                    }
                    className="h-7 text-xs w-32"
                  />
                </div>
              </div>

              {/* Payments */}
              <div className="space-y-1.5">
                {installment.payments.map((payment, pIndex) => (
                  <div
                    key={pIndex}
                    className="flex items-center gap-2 bg-muted/50 rounded-md p-1.5"
                  >
                    <Select
                      value={payment.method}
                      onValueChange={(val) =>
                        updatePayment(iIndex, pIndex, { method: val })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={payment.amount}
                        onChange={(e) =>
                          updatePayment(iIndex, pIndex, {
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    {installment.payments.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          removePaymentFromInstallment(iIndex, pIndex)
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Payment & Balance */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => addPaymentToInstallment(iIndex)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar forma
                </Button>
                {!isBalanced && (
                  <span className="text-xs text-destructive">
                    {totalAllocated > installment.amount
                      ? `+${formatCurrency(totalAllocated - installment.amount)} excedente`
                      : `${formatCurrency(installment.amount - totalAllocated)} faltando`}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
