import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContractService } from "@/lib/web3/contract-service";
import { CONTRACTS } from "@/lib/web3/config";

interface ClientRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escrowId: number;
  clientAddress: string;
  freelancerAddress: string;
  onSuccess?: () => void;
}

export function ClientRatingDialog({
  open,
  onOpenChange,
  escrowId,
  freelancerAddress,
  onSuccess,
}: ClientRatingDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Select a rating", description: "Please choose 1–5 stars.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const svc = new ContractService(CONTRACTS.SECUREFLOW_ESCROW);
      await svc.submitClientRating({
        escrow_id: escrowId,
        rating,
        review: review.trim(),
        freelancer: freelancerAddress,
      });
      toast({ title: "Rating submitted!", description: "Thank you for rating this client." });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: "Rating failed",
        description: err.message || "Could not submit rating",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Rate this Client</DialogTitle>
          <DialogDescription>
            Share your experience working with this client to help other freelancers.
          </DialogDescription>
        </DialogHeader>

        {/* Star selector */}
        <div className="flex justify-center gap-2 py-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(s)}
              className="focus:outline-none"
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  s <= (hovered || rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mb-1">
          {rating === 0
            ? "Click to rate"
            : ["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
        </p>

        <Textarea
          placeholder="Describe your experience with this client (optional)..."
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={3}
          className="resize-none"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading || rating === 0}>
            {loading ? "Submitting…" : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
