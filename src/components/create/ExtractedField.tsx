import { useState } from "react";
import { Check, Edit3, X, FileText, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ExtractedValue {
  key: string;
  label: string;
  value: string;
  confidence: number;
  source?: string;
  sourceDoc?: string;
  multiline?: boolean;
}

interface Props {
  field: ExtractedValue;
  onAccept: (key: string, value: string) => void;
  onReject: (key: string) => void;
}

function confidenceBadge(c: number) {
  if (c >= 0.8) return { label: "Haute", variant: "default" as const, color: "text-green-600" };
  if (c >= 0.5) return { label: "Moyenne", variant: "secondary" as const, color: "text-yellow-600" };
  return { label: "Faible", variant: "outline" as const, color: "text-orange-500" };
}

export default function ExtractedField({ field, onAccept, onReject }: Props) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(field.value);
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);

  const conf = confidenceBadge(field.confidence);

  if (rejected) return null;

  const handleAccept = () => {
    setAccepted(true);
    setEditing(false);
    onAccept(field.key, localValue);
  };

  const handleReject = () => {
    setRejected(true);
    onReject(field.key);
  };

  return (
    <div className={`rounded-lg border p-4 transition-all ${
      accepted ? "border-green-500/30 bg-green-500/5" : "border-border"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{field.label}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant={conf.variant} className={`text-xs ${conf.color}`}>
                  {Math.round(field.confidence * 100)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Confiance : {conf.label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {field.confidence < 0.6 && (
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {!accepted && (
            <>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(!editing)}>
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600 hover:text-green-700" onClick={handleAccept}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={handleReject}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {accepted && (
            <Badge variant="default" className="text-xs bg-green-600">
              <Check className="h-3 w-3 mr-1" /> Accepté
            </Badge>
          )}
        </div>
      </div>

      {editing ? (
        field.multiline ? (
          <Textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            rows={4}
            className="text-sm"
          />
        ) : (
          <Input
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className="text-sm"
          />
        )
      ) : (
        <p className="text-sm text-foreground whitespace-pre-wrap">{localValue}</p>
      )}

      {field.sourceDoc && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>Source : {field.sourceDoc}</span>
        </div>
      )}
    </div>
  );
}
