import { NavLink, Route, Routes } from 'react-router-dom';
import TrackPage from './pages/TrackPage';
import IntakePage from './pages/IntakePage';
import InventoryPage from './pages/InventoryPage';
import VouchersPage from './pages/VouchersPage';
import ShipmentsPage from './pages/ShipmentsPage';

export default function App() {
  return (
    <div>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">🔋 旧电瓶回收凭证与去向追踪</div>
          <nav className="nav">
            <NavLink to="/" end>
              去向追踪
            </NavLink>
            <NavLink to="/intake">旧件入库</NavLink>
            <NavLink to="/inventory">暂存库存</NavLink>
            <NavLink to="/vouchers">回收凭证</NavLink>
            <NavLink to="/shipments">发货与签收</NavLink>
          </nav>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<TrackPage />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/vouchers" element={<VouchersPage />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
        </Routes>
      </main>
    </div>
  );
}
