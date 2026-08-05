export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ShopifyApp. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="#" className="hover:underline">Terms</a>
          <a href="#" className="hover:underline">Privacy Policy</a>
        </div>
      </div>
    </footer>
  );
};
