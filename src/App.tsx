/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db, initializeStorage } from './services/storage';
import { User, Business, Product } from './types';

// Components
import { PublicLanding } from './components/public/PublicLanding';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterBusinessModal } from './components/auth/RegisterBusinessModal';
import { GmailVerificationModal } from './components/auth/GmailVerificationModal';
import { BusinessLayout } from './components/layout/BusinessLayout';
import { BusinessDashboard } from './components/dashboard/BusinessDashboard';
import { ProductList } from './components/products/ProductList';
import { AddEditProductModal } from './components/products/AddEditProductModal';
import { ProductDetailModal } from './components/products/ProductDetailModal';
import { StockReceivingModal } from './components/stock/StockReceivingModal';
import { StockAdjustmentModal } from './components/stock/StockAdjustmentModal';
import { StockHistoryModal } from './components/stock/StockHistoryModal';
import { POSView } from './components/pos/POSView';
import { BarcodeScannerView } from './components/scanner/BarcodeScannerView';
import { ReportsView } from './components/reports/ReportsView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { BusinessSettingsView } from './components/settings/BusinessSettingsView';
import { SuperAdminDashboard } from './components/superadmin/SuperAdminDashboard';
import { OwnerOrdersView } from './components/orders/OwnerOrdersView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'pos' | 'scanner' | 'reports' | 'suppliers' | 'settings'>('dashboard');
  const [dataVersion, setDataVersion] = useState(0);

  // Modals state
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productForDetail, setProductForDetail] = useState<Product | null>(null);
  const [productForReceive, setProductForReceive] = useState<Product | null>(null);
  const [isReceiveStockOpen, setIsReceiveStockOpen] = useState(false);
  const [productForAdjustment, setProductForAdjustment] = useState<Product | null>(null);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [productForHistory, setProductForHistory] = useState<Product | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // POS initial product transfer (e.g. from scanner)
  const [posInitialProduct, setPosInitialProduct] = useState<Product | null>(null);

  // Super Admin emulation of tenant workspace
  const [isSuperAdminSwitched, setIsSuperAdminSwitched] = useState(false);

  // Force public view mode when logged in
  const [isViewingPublicMode, setIsViewingPublicMode] = useState(false);

  // Mandatory Gmail Verification Modal state
  const [verificationState, setVerificationState] = useState<{
    isOpen: boolean;
    email: string;
  }>({
    isOpen: false,
    email: '',
  });

  // Initialize from storage & sync
  useEffect(() => {
    initializeStorage();

    const refreshSession = () => {
      const user = db.getCurrentUser();
      if (user) {
        if (user.status === 'pending' || user.emailVerified === false) {
          // Account is inactive pending verification
          db.logout();
          setCurrentUser(null);
          setCurrentBusiness(null);
          return;
        }

        setCurrentUser((prev) => {
          if (
            !prev ||
            prev.id !== user.id ||
            prev.email !== user.email ||
            prev.role !== user.role ||
            prev.businessId !== user.businessId
          ) {
            return user;
          }
          return prev;
        });
        if (user.businessId) {
          const biz = db.getBusinessById(user.businessId);
          setCurrentBusiness((prev) => {
            if (!prev || prev.id !== biz?.id || prev.name !== biz?.name) {
              return biz || null;
            }
            return prev;
          });
        }
      }
    };

    refreshSession();

    const handleStorageUpdate = () => {
      refreshSession();
    };

    window.addEventListener('spm_storage_update', handleStorageUpdate);
    return () => {
      window.removeEventListener('spm_storage_update', handleStorageUpdate);
    };
  }, []);

  const handleLoginSuccess = (user: User) => {
    if (user.status === 'pending' || user.emailVerified === false) {
      setVerificationState({
        isOpen: true,
        email: user.email,
      });
      return;
    }
    setCurrentUser(user);
    if (user.businessId) {
      const biz = db.getBusinessById(user.businessId);
      setCurrentBusiness(biz);
    } else {
      setCurrentBusiness(null);
    }
    setIsLoginOpen(false);
    setIsViewingPublicMode(false);
    setActiveTab('dashboard');
  };

  const handleRegisterSuccess = (business: Business, user: User) => {
    if (user.status === 'pending' || user.emailVerified === false) {
      setVerificationState({
        isOpen: true,
        email: user.email,
      });
      return;
    }
    setCurrentUser(user);
    setCurrentBusiness(business);
    setIsRegisterOpen(false);
    setIsViewingPublicMode(false);
    setActiveTab('dashboard');
  };

  const handleRequireGmailVerification = (email: string) => {
    setIsRegisterOpen(false);
    setIsLoginOpen(false);
    setVerificationState({
      isOpen: true,
      email,
    });
  };

  const handleGmailVerified = (verifiedUser: User, verifiedBusiness: Business) => {
    setVerificationState({ isOpen: false, email: '' });
    db.setCurrentUser(verifiedUser);
    setCurrentUser(verifiedUser);
    setCurrentBusiness(verifiedBusiness);
    setIsViewingPublicMode(false);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    db.logout();
    setCurrentUser(null);
    setCurrentBusiness(null);
    setIsSuperAdminSwitched(false);
    setIsViewingPublicMode(false);
  };

  // Super Admin switches to a business workspace
  const handleSuperAdminSwitch = (business: Business) => {
    setCurrentBusiness(business);
    setIsSuperAdminSwitched(true);
    setActiveTab('dashboard');
  };

  const handleReturnToSuperAdmin = () => {
    if (currentUser?.role === 'super_admin') {
      const user = db.getCurrentUser();
      setCurrentUser(user);
      setCurrentBusiness(null);
      setIsSuperAdminSwitched(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER FLOW 1: Public Landing View (Before Login or View Toggle)
  // -------------------------------------------------------------
  if (!currentUser || isViewingPublicMode) {
    return (
      <>
        <PublicLanding
          onOpenLogin={() => setIsLoginOpen(true)}
          onOpenRegister={() => setIsRegisterOpen(true)}
          currentUser={currentUser}
          onReturnToDashboard={currentUser ? () => setIsViewingPublicMode(false) : undefined}
        />

        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onSuccess={handleLoginSuccess}
          onSwitchToRegister={() => {
            setIsLoginOpen(false);
            setIsRegisterOpen(true);
          }}
          onRequireGmailVerification={handleRequireGmailVerification}
        />

        <RegisterBusinessModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={handleRegisterSuccess}
          onSwitchToLogin={() => {
            setIsRegisterOpen(false);
            setIsLoginOpen(true);
          }}
          onRequireGmailVerification={handleRequireGmailVerification}
        />

        <GmailVerificationModal
          isOpen={verificationState.isOpen}
          onClose={() => setVerificationState((prev) => ({ ...prev, isOpen: false }))}
          initialEmail={verificationState.email}
          onVerified={handleGmailVerified}
          onSwitchToLogin={() => {
            setVerificationState((prev) => ({ ...prev, isOpen: false }));
            setIsLoginOpen(true);
          }}
        />
      </>
    );
  }

  // -------------------------------------------------------------
  // RENDER FLOW 2: Super Admin Platform Panel (If not switched)
  // -------------------------------------------------------------
  if (currentUser.role === 'super_admin' && !isSuperAdminSwitched) {
    return (
      <SuperAdminDashboard
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchToBusiness={handleSuperAdminSwitch}
      />
    );
  }

  // -------------------------------------------------------------
  // RENDER FLOW 3: Business Owner / Manager / Staff Dashboard
  // -------------------------------------------------------------
  const businessId = currentBusiness?.id || currentUser.businessId || 'BIZ-001';

  return (
    <>
      <BusinessLayout
        business={currentBusiness}
        currentUser={currentUser}
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onLogout={handleLogout}
        onOpenPublicView={() => setIsViewingPublicMode(true)}
        onOpenAddProduct={() => {
          setProductToEdit(null);
          setIsAddProductOpen(true);
        }}
        isSuperAdminSwitched={isSuperAdminSwitched}
        onReturnToSuperAdmin={handleReturnToSuperAdmin}
      >
        {activeTab === 'dashboard' && (
          <BusinessDashboard
            businessId={businessId}
            business={currentBusiness}
            currentUser={currentUser}
            onNavigate={setActiveTab}
            onOpenAddProduct={() => {
              setProductToEdit(null);
              setIsAddProductOpen(true);
            }}
            onOpenReceiveStock={(prod) => {
              setProductForReceive(prod || null);
              setIsReceiveStockOpen(true);
            }}
            onOpenProductDetail={(prod) => setProductForDetail(prod)}
            onOpenStockHistory={(prod) => {
              setProductForHistory(prod);
              setIsHistoryOpen(true);
            }}
            onOpenStockAdjustment={(prod) => {
              setProductForAdjustment(prod || null);
              setIsAdjustmentOpen(true);
            }}
          />
        )}

        {activeTab === 'products' && (
          <ProductList
            businessId={businessId}
            business={currentBusiness}
            currentUser={currentUser}
            dataVersion={dataVersion}
            onOpenAddProduct={() => {
              setProductToEdit(null);
              setIsAddProductOpen(true);
            }}
            onOpenEditProduct={(prod) => {
              setProductToEdit(prod);
              setIsAddProductOpen(true);
            }}
            onOpenProductDetail={(prod) => setProductForDetail(prod)}
            onOpenStockHistory={(prod) => {
              setProductForHistory(prod);
              setIsHistoryOpen(true);
            }}
            onOpenReceiveStock={(prod) => {
              setProductForReceive(prod);
              setIsReceiveStockOpen(true);
            }}
            onOpenStockAdjustment={(prod) => {
              setProductForAdjustment(prod);
              setIsAdjustmentOpen(true);
            }}
          />
        )}

        {activeTab === 'orders' && (
          <OwnerOrdersView
            businessId={businessId}
            business={currentBusiness}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'pos' && (
          <POSView
            businessId={businessId}
            business={currentBusiness}
            currentUser={currentUser}
            initialProductToAdd={posInitialProduct}
          />
        )}

        {activeTab === 'scanner' && (
          <BarcodeScannerView
            businessId={businessId}
            business={currentBusiness}
            onNavigateToPOSWithProduct={(prod) => {
              setPosInitialProduct(prod);
              setActiveTab('pos');
            }}
            onOpenReceiveStock={(prod) => {
              setProductForReceive(prod);
              setIsReceiveStockOpen(true);
            }}
            onOpenProductDetail={(prod) => setProductForDetail(prod)}
            onOpenStockHistory={(prod) => {
              setProductForHistory(prod);
              setIsHistoryOpen(true);
            }}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersView businessId={businessId} />
        )}

        {activeTab === 'reports' && (
          <ReportsView businessId={businessId} business={currentBusiness} />
        )}

        {activeTab === 'settings' && (
          <BusinessSettingsView
            businessId={businessId}
            business={currentBusiness}
            currentUser={currentUser}
            onBusinessUpdated={(updated) => setCurrentBusiness(updated)}
          />
        )}
      </BusinessLayout>

      {/* Global Action Modals */}
      <AddEditProductModal
        isOpen={isAddProductOpen}
        onClose={() => {
          setIsAddProductOpen(false);
          setProductToEdit(null);
        }}
        onSaved={() => {
          setDataVersion((v) => v + 1);
          setActiveTab('products');
        }}
        productToEdit={productToEdit}
        businessId={businessId}
        currentUser={currentUser}
      />

      <ProductDetailModal
        isOpen={!!productForDetail}
        onClose={() => setProductForDetail(null)}
        product={productForDetail}
        business={currentBusiness}
        onOpenStockHistory={(prod) => {
          setProductForHistory(prod);
          setIsHistoryOpen(true);
        }}
        onOpenStockReceive={(prod) => {
          setProductForReceive(prod);
          setIsReceiveStockOpen(true);
        }}
      />

      <StockReceivingModal
        isOpen={isReceiveStockOpen}
        onClose={() => {
          setIsReceiveStockOpen(false);
          setProductForReceive(null);
        }}
        onSuccess={() => {
          setDataVersion((v) => v + 1);
        }}
        preselectedProduct={productForReceive}
        businessId={businessId}
        currentUser={currentUser}
      />

      <StockAdjustmentModal
        isOpen={isAdjustmentOpen}
        onClose={() => {
          setIsAdjustmentOpen(false);
          setProductForAdjustment(null);
        }}
        onSuccess={() => {
          setDataVersion((v) => v + 1);
        }}
        preselectedProduct={productForAdjustment}
        businessId={businessId}
        currentUser={currentUser}
      />

      <StockHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setProductForHistory(null);
        }}
        product={productForHistory}
        businessId={businessId}
      />
    </>
  );
}
