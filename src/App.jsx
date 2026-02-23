import { useState } from 'react'
import { Routes, Route, useSearchParams } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import HomePage from './components/HomePage/HomePage'
import CatalogPage from './components/CatalogPage/CatalogPage'
import CarDetailPage from './components/CarDetailPage/CarDetailPage'
import ContactPage from './components/ContactPage/ContactPage'
import WhyUsPage from './components/WhyUsPage/WhyUsPage'
import SearchPage from './components/SearchPage/SearchPage'
import CabinetPage from './components/CabinetPage/CabinetPage'
import ProfilePage from './components/ProfilePage/ProfilePage'
import FavoritesPage from './components/FavoritesPage/FavoritesPage'
import ViewedCarsPage from './components/ViewedCarsPage/ViewedCarsPage'
import MyRequestsPage from './components/MyRequestsPage/MyRequestsPage'
import MyOrdersPage from './components/MyOrdersPage/MyOrdersPage'
import AdminPanel from './components/AdminPanel/AdminPanel'
import AuthModal from './components/AuthModal/AuthModal'
import ChatWidget from './components/ChatWidget/ChatWidget'
import MobileNav from './components/MobileNav/MobileNav'
import './App.css'

function App() {
  const [authOpen, setAuthOpen] = useState(false)
  const openAuth = () => setAuthOpen(true)
  const [searchParams] = useSearchParams()

  /* Если ?admin=True — показываем админ-панель поверх всего */
  if (searchParams.get('admin') === 'True') {
    return <AdminPanel />
  }

  return (
    <div className="app">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage onAuthOpen={openAuth} />} />
        <Route path="/catalog" element={<CatalogPage onAuthOpen={openAuth} />} />
        <Route path="/catalog/:id" element={<CarDetailPage onAuthOpen={openAuth} />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/about" element={<WhyUsPage onAuthOpen={openAuth} />} />
        <Route path="/search" element={<SearchPage onAuthOpen={openAuth} />} />
        <Route path="/cabinet" element={<CabinetPage onAuthOpen={openAuth} />} />
        <Route path="/cabinet/profile" element={<ProfilePage onAuthOpen={openAuth} />} />
        <Route path="/cabinet/favorites" element={<FavoritesPage onAuthOpen={openAuth} />} />
        <Route path="/cabinet/viewed" element={<ViewedCarsPage onAuthOpen={openAuth} />} />
        <Route path="/cabinet/requests" element={<MyRequestsPage onAuthOpen={openAuth} />} />
        <Route path="/cabinet/orders" element={<MyOrdersPage onAuthOpen={openAuth} />} />
      </Routes>
      <ChatWidget />
      <MobileNav onAuthOpen={openAuth} />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

export default App
