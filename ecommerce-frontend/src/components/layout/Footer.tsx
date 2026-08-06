import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ShopifyApp. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/terms" className="hover:underline">Terms</Link>
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
        </div>
      </div>
    </footer>
  );
};
