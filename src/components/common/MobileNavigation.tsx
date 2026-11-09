import React from 'react';
import { Home, Compass, Heart, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

interface MobileNavigationProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ currentPath, onNavigate }) => {
  const { totalItemsCount } = useCart();
  const { wishlistIds } = useWishlist();

  const tabs = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Shop', path: '/shop', icon: Compass },
    { label: 'Wishlist', path: '/wishlist', icon: Heart, count: wishlistIds.length },
    { label: 'Cart', path: '/cart', icon: ShoppingBag, count: totalItemsCount },
    { label: 'Account', path: '/account', icon: User }
  ];

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E5DFD7] z-40 py-1.5 px-2 shadow-lg">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentPath === tab.path;

          return (
            <button
              key={tab.path}
              onClick={() => onNavigate(tab.path)}
              className={`flex flex-col items-center justify-center py-1 px-3 relative transition-colors ${
                isActive ? 'text-[#1E3A2F]' : 'text-[#626C66] hover:text-[#1A1E1C]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#C85A32] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {tab.count}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
