import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Save, Printer, Stethoscope, Loader2, Camera, Sparkles, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { HRAdmission, useUpdateAdmission } from "@/hooks/useHRAdmissions";
import DocumentCameraCapture from "@/components/admission/DocumentCameraCapture";

interface Props {
  admission: HRAdmission;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const EXAMS_LEFT = [
  "EXAME CLÍNICO",
  "AUDIOMETRIA TONAL",
  "ACUIDADE VISUAL",
  "AVALIAÇÃO CLÍNICA",
  "AVALIAÇÃO PSICOSSOCIAL",
  "COPROCULTURA",
  "ELETROCARDIOGRAMA – ECG",
  "ELETROENCEFALOGRAMA – EEG",
  "GLICEMIA JEJUM",
  "HEMOGRAMA COMPLETO",
  "PROTOPARASITOLÓGICO DE FEZES – PPF",
  "RAIO X TÓRAX PA",
];
const EXAMS_RIGHT = [
  "HEPATITE B (Anti-HBc IgM)",
  "HEPATITE B (HBsAg)",
  "HEPATITE B (Anti-HBs)",
  "HEPATITE C (Anti-HCV)",
  "TESTE ISHIHARA",
  "TGO",
  "TGP",
  "UREIA / CREATININA",
  "URINA I",
  "RADIOGRAFIA DE TÓRAX (O.I.T.)",
  "TOXICOLÓGICO",
];
const EXAM_TYPES = [
  { key: "admissional", label: "ADMISSIONAL" },
  { key: "periodico", label: "PERIÓDICO" },
  { key: "demissional", label: "DEMISSIONAL" },
  { key: "retorno", label: "RETORNO AO TRABALHO" },
  { key: "mudanca_risco", label: "MUDANÇA DE RISCO" },
  { key: "avaliacao_clinica", label: "AVALIAÇÃO CLÍNICA" },
];

type ReferralData = {
  cnpj?: string;
  company_name?: string;
  unit?: string;
  city?: string;
  state?: string;
  exam_date?: string; // yyyy-mm-dd
  exam_time?: string; // hh:mm
  employee_name?: string;
  doc_id?: string;
  cpf?: string;
  cnh_number?: string;
  cnh_validity?: string;
  birth_date?: string;
  job_function?: string;
  sector?: string;
  doctor_name?: string;
  doctor_crm_uf?: string;
  doctor_rqe?: string;
  exam_type?: string;
  exams?: string[];
};

export default function ExamReferralDialog({ admission, open, onOpenChange }: Props) {
  const { currentUser } = useCurrentUser();
  const updateAdmission = useUpdateAdmission();
  const printRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ReferralData>({});
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [cameraOpen, setCameraOpen] = useState<null | "id" | "cpf">(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputCpfRef = useRef<HTMLInputElement | null>(null);

  const dateBRtoISO = (s: string | undefined | null): string | undefined => {
    if (!s) return undefined;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return undefined;
    return `${m[3]}-${m[2]}-${m[1]}`;
  };

  const runOcr = async (kind: "id" | "cpf", files: File[]) => {
    if (files.length === 0) return;
    setOcrBusy(true);
    try {
      // Converte para data URLs
      const dataUrls = await Promise.all(
        files.slice(0, 4).map((f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ""));
            r.onerror = reject;
            r.readAsDataURL(f);
          })
        )
      );
      const { data: res, error } = await supabase.functions.invoke("ocr-document", {
        body: { kind, images: dataUrls },
      });
      if (error) throw error;
      const d = (res as any)?.data || {};
      if (!d || Object.keys(d).length === 0) {
        toast.error("Não consegui ler. Tente outra foto, com mais luz e foco.");
        return;
      }
      // Aplica nos campos
      setData((prev) => {
        const next = { ...prev };
        if (kind === "id") {
          if (d.nome) next.employee_name = d.nome;
          if (d.cpf) next.cpf = d.cpf;
          // Doc Identificação: sempre preenche com RG (tanto RG quanto CNH costumam ter o nº do RG)
          if (d.rg) {
            next.doc_id = `RG ${d.rg}${d.rg_orgao_emissor ? " " + d.rg_orgao_emissor : ""}`;
          }
          // CNH vai pros campos próprios
          if (d.tipo && /CNH/i.test(d.tipo)) {
            if (d.cnh_numero) next.cnh_number = d.cnh_numero;
            const iso = dateBRtoISO(d.cnh_validade);
            if (iso) next.cnh_validity = iso;
          }
          const bn = dateBRtoISO(d.data_nascimento);
          if (bn) next.birth_date = bn;
        } else if (kind === "cpf") {
          if (d.cpf) next.cpf = d.cpf;
          if (d.nome && !next.employee_name) next.employee_name = d.nome;
        }
        return next;
      });
      const filled = Object.keys(d).length;
      toast.success(`${filled} campo${filled > 1 ? "s" : ""} preenchido${filled > 1 ? "s" : ""} automaticamente`);
    } catch (e: any) {
      toast.error("Erro no OCR: " + (e?.message || e));
    } finally {
      setOcrBusy(false);
    }
  };

  // Load defaults + existing referral_data
  useEffect(() => {
    if (!open || !currentUser?.account_id) return;
    let cancelled = false;
    (async () => {
      const { data: defaults } = await supabase
        .from("hr_exam_referral_defaults" as any)
        .select("*")
        .eq("account_id", currentUser.account_id)
        .maybeSingle();

      const existing = ((admission as any).referral_data || {}) as ReferralData;
      if (cancelled) return;

      const d = (defaults as any) || {};
      const examDate = admission.exam_scheduled_at ? new Date(admission.exam_scheduled_at) : null;
      setData({
        cnpj: "53.844.206/0001-64",
        company_name: "Eternum Mentoring Club Ltda",
        unit: existing.unit ?? d.default_unit ?? "",
        city: existing.city ?? d.default_city ?? "",
        state: existing.state ?? d.default_state ?? "",
        exam_date: existing.exam_date ?? (examDate ? examDate.toISOString().slice(0, 10) : ""),
        exam_time: existing.exam_time ?? (examDate ? examDate.toTimeString().slice(0, 5) : ""),
        employee_name: existing.employee_name ?? admission.candidate_name ?? "",
        doc_id: existing.doc_id ?? "",
        cpf: existing.cpf ?? "",
        cnh_number: existing.cnh_number ?? "",
        cnh_validity: existing.cnh_validity ?? "",
        birth_date: existing.birth_date ?? "",
        job_function: existing.job_function ?? admission.position_title ?? "",
        sector: existing.sector ?? admission.department ?? "",
        doctor_name: existing.doctor_name ?? d.doctor_name ?? "",
        doctor_crm_uf: existing.doctor_crm_uf ?? d.doctor_crm_uf ?? "",
        doctor_rqe: existing.doctor_rqe ?? d.doctor_rqe ?? "",
        exam_type: existing.exam_type ?? "admissional",
        exams: existing.exams ?? ["EXAME CLÍNICO"],
      });
    })();
    return () => { cancelled = true; };
  }, [open, currentUser?.account_id, admission]);

  const upd = (patch: Partial<ReferralData>) => setData((p) => ({ ...p, ...patch }));
  const toggleExam = (label: string) => {
    setData((p) => {
      const cur = new Set(p.exams || []);
      if (cur.has(label)) cur.delete(label); else cur.add(label);
      return { ...p, exams: Array.from(cur) };
    });
  };

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);
    try {
      await updateAdmission.mutateAsync({ id: admission.id, referral_data: data as any } as any);
      if (saveAsDefault) {
        await supabase.from("hr_exam_referral_defaults" as any).upsert({
          account_id: currentUser.account_id,
          company_name: data.company_name || null,
          company_cnpj: data.cnpj || null,
          doctor_name: data.doctor_name || null,
          doctor_crm_uf: data.doctor_crm_uf || null,
          doctor_rqe: data.doctor_rqe || null,
          default_unit: data.unit || null,
          default_city: data.city || null,
          default_state: data.state || null,
        });
        toast.success("Guia salva e dados fixos atualizados");
      } else {
        toast.success("Guia salva");
      }
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) { toast.error("Bloqueador de pop-up impediu a impressão"); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Guia de Encaminhamento</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; }
        h1 { font-size: 16px; text-align: center; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
        th { background: #e6e6e6; text-align: left; }
        .section { background: #d9d9d9; font-weight: bold; text-align: center; }
        .check { display: inline-block; width: 10px; height: 10px; border: 1px solid #000; margin-right: 4px; vertical-align: middle; text-align: center; line-height: 9px; font-size: 9px; }
        .footer { margin-top: 12px; font-size: 9px; text-align: center; color: #333; }
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
  };

  const examTable = useMemo(() => {
    const rows = Math.max(EXAMS_LEFT.length, EXAMS_RIGHT.length);
    return Array.from({ length: rows }).map((_, i) => ({
      left: EXAMS_LEFT[i],
      right: EXAMS_RIGHT[i],
    }));
  }, []);

  const checked = (k: string) => (data.exams || []).includes(k);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[92vh] overflow-y-auto"
        onPointerDownOutside={(e) => { if (cameraOpen) e.preventDefault(); }}
        onInteractOutside={(e) => { if (cameraOpen) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (cameraOpen) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-rose-600" />
            Guia de Encaminhamento — Exame Ocupacional
          </DialogTitle>
          <DialogDescription>
            Preenchimento automático com os dados da Eternum e do candidato. Marque os exames solicitados e imprima ou envie para a C3 Saúde.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FORM */}
          <div className="space-y-4">
            <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground">EMPRESA (Eternum)</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">CNPJ</Label><Input value={data.cnpj || ""} onChange={(e) => upd({ cnpj: e.target.value })} /></div>
                <div><Label className="text-xs">Nome da empresa</Label><Input value={data.company_name || ""} onChange={(e) => upd({ company_name: e.target.value })} /></div>
                <div><Label className="text-xs">Unidade</Label><Input value={data.unit || ""} onChange={(e) => upd({ unit: e.target.value })} /></div>
                <div><Label className="text-xs">Cidade do atendimento</Label><Input value={data.city || ""} onChange={(e) => upd({ city: e.target.value })} /></div>
                <div><Label className="text-xs">Estado</Label><Input value={data.state || ""} onChange={(e) => upd({ state: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Data exame</Label><Input type="date" value={data.exam_date || ""} onChange={(e) => upd({ exam_date: e.target.value })} /></div>
                  <div><Label className="text-xs">Horário</Label><Input type="time" value={data.exam_time || ""} onChange={(e) => upd({ exam_time: e.target.value })} /></div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-semibold text-muted-foreground">FUNCIONÁRIO</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={ocrBusy} onClick={() => setCameraOpen("id")}>
                    {ocrBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Camera className="h-3 w-3 mr-1" />} RG/CNH
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={ocrBusy} onClick={() => setCameraOpen("cpf")}>
                    <Camera className="h-3 w-3 mr-1" /> CPF
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={ocrBusy} onClick={() => fileInputRef.current?.click()} title="Enviar arquivo (RG/CNH)">
                    <Upload className="h-3 w-3" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      const fs = Array.from(e.target.files || []);
                      if (fs.length) runOcr("id", fs);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={fileInputCpfRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const fs = Array.from(e.target.files || []);
                      if (fs.length) runOcr("cpf", fs);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Use a câmera ou envie a foto — o sistema preenche os campos automaticamente.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Label className="text-xs">Nome</Label><Input value={data.employee_name || ""} onChange={(e) => upd({ employee_name: e.target.value })} /></div>
                <div><Label className="text-xs">Doc. Identificação</Label><Input value={data.doc_id || ""} onChange={(e) => upd({ doc_id: e.target.value })} placeholder="RG xx.xxx.xxx-x" /></div>
                <div><Label className="text-xs">CPF</Label><Input value={data.cpf || ""} onChange={(e) => upd({ cpf: e.target.value })} /></div>
                <div><Label className="text-xs">CNH (toxicológico)</Label><Input value={data.cnh_number || ""} onChange={(e) => upd({ cnh_number: e.target.value })} /></div>
                <div><Label className="text-xs">Validade CNH</Label><Input type="date" value={data.cnh_validity || ""} onChange={(e) => upd({ cnh_validity: e.target.value })} /></div>
                <div><Label className="text-xs">Data nascimento</Label><Input type="date" value={data.birth_date || ""} onChange={(e) => upd({ birth_date: e.target.value })} /></div>
                <div><Label className="text-xs">Função</Label><Input value={data.job_function || ""} onChange={(e) => upd({ job_function: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Setor</Label><Input value={data.sector || ""} onChange={(e) => upd({ sector: e.target.value })} /></div>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">MÉDICO COORDENADOR</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Label className="text-xs">Nome</Label><Input value={data.doctor_name || ""} onChange={(e) => upd({ doctor_name: e.target.value })} /></div>
                <div><Label className="text-xs">CRM/UF</Label><Input value={data.doctor_crm_uf || ""} onChange={(e) => upd({ doctor_crm_uf: e.target.value })} /></div>
                <div><Label className="text-xs">R.Q.E.</Label><Input value={data.doctor_rqe || ""} onChange={(e) => upd({ doctor_rqe: e.target.value })} /></div>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">TIPO DE EXAME</p>
              <div className="grid grid-cols-2 gap-1">
                {EXAM_TYPES.map((t) => (
                  <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="exam_type" checked={data.exam_type === t.key} onChange={() => upd({ exam_type: t.key })} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">EXAMES SOLICITADOS</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[...EXAMS_LEFT, ...EXAMS_RIGHT].map((ex) => (
                  <label key={ex} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={checked(ex)} onCheckedChange={() => toggleExam(ex)} />
                    <span>{ex}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded border bg-amber-500/5 border-amber-500/30">
              <Checkbox checked={saveAsDefault} onCheckedChange={(v) => setSaveAsDefault(!!v)} />
              <span>Salvar empresa e médico coordenador como padrão (auto-preenche próximos guias)</span>
            </label>
          </div>

          {/* PREVIEW */}
          <div className="rounded-lg border bg-white text-black p-4 overflow-auto" style={{ maxHeight: "80vh" }}>
            <div ref={printRef}>
              <h1>GUIA DE ENCAMINHAMENTO</h1>
              <table>
                <tbody>
                  <tr><td style={{ width: "30%" }}><b>CNPJ / CPF</b></td><td colSpan={3}>{data.cnpj}</td></tr>
                  <tr><td><b>NOME DA EMPRESA</b></td><td colSpan={3}>{data.company_name}</td></tr>
                  <tr><td><b>UNIDADE</b></td><td colSpan={3}>{data.unit}</td></tr>
                  <tr><td><b>CIDADE DO ATENDIMENTO</b></td><td colSpan={3}>{data.city}</td></tr>
                  <tr><td><b>ESTADO</b></td><td colSpan={3}>{data.state}</td></tr>
                  <tr><td><b>DATA DO EXAME</b></td><td>{data.exam_date}</td><td><b>HORÁRIO</b></td><td>{data.exam_time}</td></tr>
                  <tr><td><b>NOME DO FUNCIONÁRIO</b></td><td colSpan={3}>{data.employee_name}</td></tr>
                  <tr><td><b>DOC. IDENTIFICAÇÃO</b></td><td>{data.doc_id}</td><td><b>CPF</b></td><td>{data.cpf}</td></tr>
                  <tr><td><b>CNH (Toxicológico)</b></td><td>{data.cnh_number}</td><td><b>VALIDADE</b></td><td>{data.cnh_validity}</td></tr>
                  <tr><td><b>DATA DE NASCIMENTO</b></td><td colSpan={3}>{data.birth_date}</td></tr>
                  <tr><td><b>FUNÇÃO</b></td><td colSpan={3}>{data.job_function}</td></tr>
                  <tr><td><b>SETOR</b></td><td colSpan={3}>{data.sector}</td></tr>
                  <tr><td><b>MÉDICO COORDENADOR</b></td><td colSpan={3}>{data.doctor_name}</td></tr>
                  <tr><td><b>CRM/UF</b></td><td>{data.doctor_crm_uf}</td><td><b>R.Q.E.</b></td><td>{data.doctor_rqe}</td></tr>
                </tbody>
              </table>

              <table style={{ marginTop: 8 }}>
                <tbody>
                  <tr><td className="section" colSpan={3}>TIPO DE EXAME</td></tr>
                  <tr>
                    {EXAM_TYPES.slice(0, 3).map((t) => (
                      <td key={t.key}><span className="check">{data.exam_type === t.key ? "X" : ""}</span>{t.label}</td>
                    ))}
                  </tr>
                  <tr>
                    {EXAM_TYPES.slice(3, 6).map((t) => (
                      <td key={t.key}><span className="check">{data.exam_type === t.key ? "X" : ""}</span>{t.label}</td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <table style={{ marginTop: 8 }}>
                <tbody>
                  <tr><td className="section" colSpan={2}>EXAMES OCUPACIONAIS</td></tr>
                  {examTable.map((row, i) => (
                    <tr key={i}>
                      <td style={{ width: "50%" }}>{row.left ? (<><span className="check">{checked(row.left) ? "X" : ""}</span>{row.left}</>) : null}</td>
                      <td>{row.right ? (<><span className="check">{checked(row.right) ? "X" : ""}</span>{row.right}</>) : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="footer">
                R. das Carnaubeiras, 168 — Jabaquara, São Paulo/SP, 04343-080 ·
                (11) 5197-5003 / (11) 91245-1078 · CNPJ C3 Saúde: 44.636.635/0001-55 ·
                agendamento@c3saude.com.br
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Separator className="my-2" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir / PDF</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar guia
          </Button>
        </DialogFooter>
      </DialogContent>
      {cameraOpen && (
        <DocumentCameraCapture
          open={!!cameraOpen}
          kind="id"
          title={cameraOpen === "id" ? "Foto do RG ou CNH" : "Foto do CPF"}
          onClose={() => setCameraOpen(null)}
          onCapture={(file) => {
            const kind = cameraOpen;
            if (kind) runOcr(kind, [file]);
          }}
        />
      )}
    </Dialog>
  );
}
