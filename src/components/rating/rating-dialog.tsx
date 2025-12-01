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
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { contractService } from "@/lib/web3/contract-service";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/contexts/web3-context";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escrowId: number;
  freelancerAddress: string;
  onRatingSubmitted?: () => void;
}

// Note: freelancerAddress is kept for future use (e.g., displaying freelancer info)

export function RatingDialog({
  open,
  onOpenChange,
  escrowId,
  freelancerAddress: _freelancerAddress,
  onRatingSubmitted,
}: RatingDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { wallet } = useWeb3();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a rating before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!review.trim()) {
      toast({
        title: "Review Required",
        description: "Please write a review before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!wallet.isConnected || !wallet.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to submit a rating.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await contractService.submitRating(
        escrowId,
        rating,
        review,
        wallet.address || undefined
      );
      toast({
        title: "Rating Submitted",
        description: "Thank you for your feedback!",
      });
      setRating(0);
      setReview("");
      onOpenChange(false);
      onRatingSubmitted?.();
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast({
        title: "Rating Failed",
        description:
          error?.message || "Could not submit rating. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Freelancer</DialogTitle>
          <DialogDescription>
            Share your experience working with this freelancer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Rating</Label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="review">Review</Label>
            <Textarea
              id="review"
              placeholder="Share your experience with this freelancer..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0 || !review.trim()}
          >
            {submitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
