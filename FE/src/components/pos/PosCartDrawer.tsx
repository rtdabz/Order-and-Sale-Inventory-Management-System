import { ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import PosCart from './PosCart';
import { useOrders } from '../../context/OrderContext';

interface PosCartDrawerProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

/**
 * Drawer presentation of the POS cart for narrow viewports.
 *
 * All cart, payment and checkout behaviour lives in `PosCart`; this component
 * only handles the slide-over shell and the floating cart button, so the docked
 * cart on the POS page and this drawer can never drift apart.
 */
const PosCartDrawer: React.FC<PosCartDrawerProps> = ({ isOpen, toggleSidebar }) => {
  const { orders } = useOrders();
  const hasOrders = orders.length > 0;
  const itemCount = orders.reduce((sum, order) => sum + order.quantity, 0);
  const [showFloatingButton, setShowFloatingButton] = useState(false);

  // The floating button only appears once the catalog has been scrolled.
  useEffect(() => {
    const handleScroll = () => setShowFloatingButton(window.scrollY > 200);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock background scrolling while the drawer is open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, toggleSidebar]);

  return (
    <>
      <div
        onClick={toggleSidebar}
        aria-hidden="true"
        className={`fixed inset-0 z-[100000] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      />

      <aside
        aria-label="Cart"
        aria-hidden={!isOpen}
        className={`fixed right-0 top-0 z-[100001] flex h-screen w-full max-w-[420px] flex-col bg-gray-50 p-3 shadow-2xl transition-transform duration-300 ease-in-out dark:bg-gray-950 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <PosCart onClose={toggleSidebar} className="h-full" />
      </aside>

      {hasOrders && !isOpen && showFloatingButton && (
        <div className="fixed bottom-6 right-6 z-[99999] xl:hidden">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={`Open cart with ${itemCount} item${itemCount === 1 ? '' : 's'}`}
            className="relative flex items-center justify-center rounded-full bg-brand-500 p-4 text-white shadow-lg transition-all duration-200 hover:bg-brand-600 hover:shadow-xl"
          >
            <ShoppingCart className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand-500 bg-white text-xs font-bold text-brand-600">
              {itemCount}
            </span>
          </button>
        </div>
      )}
    </>
  );
};

export default PosCartDrawer;
