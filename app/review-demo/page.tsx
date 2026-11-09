import { notFound } from "next/navigation";
import { SubtitleProofingTool } from "../../components/subtitle-proofing-tool";
import { reviewDemo } from "../../lib/review-demo";

export default function ReviewDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SubtitleProofingTool initialReview={reviewDemo} demonstration />;
}
