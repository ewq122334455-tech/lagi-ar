import { Reviews } from '../Reviews';

/** All reviews, newest first. Members write one per product from the product page. */
export default function ReviewPage() {
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Review</h1>
      <div className="mx-auto max-w-4xl">
        <Reviews productId={null} />
      </div>
    </div>
  );
}
