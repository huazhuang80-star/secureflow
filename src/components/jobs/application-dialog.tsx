import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Escrow } from "@/lib/web3/types";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isApiConfigured, postCoverLetterDraft } from "@/lib/api";

interface ApplicationDialogProps {
  job: Escrow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (job: Escrow, coverLetter: string, proposedTimeline: string) => void;
  applying: boolean;
}

export function ApplicationDialog({
  job,
  open,
  onOpenChange,
  onApply,
  applying,
}: ApplicationDialogProps) {
  const { toast } = useToast();
  const [coverLetter, setCoverLetter] = useState("");
  const [proposedTimeline, setProposedTimeline] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Keep user input until the dialog actually closes (e.g. after a successful tx).
  useEffect(() => {
    if (!open) {
      setCoverLetter("");
      setProposedTimeline("");
    }
  }, [open]);

  const draftWithAi = async () => {
    if (!job) return;
    const desc = job.projectDescription?.trim() ?? "";
    if (!desc) {
      toast({
        title: "Missing job description",
        description: "This listing has no description to draft from.",
        variant: "destructive",
      });
      return;
    }
    if (!isApiConfigured()) {
      toast({
        title: "API not configured",
        description: "Set VITE_API_URL and run the SecureFlow API with GROQ_API_KEY.",
        variant: "destructive",
      });
      return;
    }
    setAiLoading(true);
    try {
      const { coverLetter: next } = await postCoverLetterDraft({
        jobTitle: job.projectTitle ?? job.projectDescription ?? `Job #${job.id}`,
        jobDescription: desc,
        proposedTimelineDays: proposedTimeline.trim() || undefined,
        tone: "professional",
      });
      setCoverLetter(next);
      toast({ title: "Draft ready", description: "Review and edit before submitting." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Draft failed";
      toast({ title: "AI unavailable", description: msg, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = () => {
    if (job && coverLetter.trim() && proposedTimeline.trim()) {
      onApply(job, coverLetter, proposedTimeline);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-thick w-[min(92vw,56rem)] max-w-4xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle className="leading-snug">
            Apply to {job?.projectTitle?.trim() || `Job #${job?.id || "Unknown"}`}
          </DialogTitle>
          <DialogDescription>
            Submit your application for this freelance opportunity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <Label htmlFor="coverLetter">Cover Letter *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => void draftWithAi()}
                disabled={aiLoading || applying || !job}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {aiLoading ? "Drafting…" : "Draft with AI"}
              </Button>
            </div>
            <Textarea
              id="coverLetter"
              placeholder="Tell us why you're the best fit for this job..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="min-h-[300px]"
              required
            />
          </div>

          <div>
            <Label htmlFor="proposedTimeline">Proposed Timeline (days) *</Label>
            <Input
              id="proposedTimeline"
              type="number"
              placeholder="e.g., 7"
              value={proposedTimeline}
              onChange={(e) => setProposedTimeline(e.target.value)}
              min="1"
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              applying || !coverLetter.trim() || !proposedTimeline.trim()
            }
          >
            {applying ? "Applying..." : "Submit Application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
