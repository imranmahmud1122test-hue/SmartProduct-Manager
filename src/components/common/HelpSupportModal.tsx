import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Mail,
  Phone,
  AlertTriangle,
  HelpCircle,
  Send,
  Upload,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  FileText,
  Trash2,
  LifeBuoy
} from 'lucide-react';
import { db } from '../../services/storage';
import { User, Business, SupportCategory, SupportSettings } from '../../types';
import { Logo } from './Logo';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  currentBusiness?: Business | null;
  initialTab?: 'contact' | 'report';
}

const CATEGORIES: { value: SupportCategory; labelEn: string; labelBn: string }[] = [
  { value: 'Login / Registration', labelEn: 'Login / Registration', labelBn: 'লগইন / রেজিস্ট্রেশন' },
  { value: 'Account Problem', labelEn: 'Account Problem', labelBn: 'অ্যাকাউন্ট সমস্যা' },
  { value: 'Product Problem', labelEn: 'Product Problem', labelBn: 'পণ্য সংক্রান্ত সমস্যা' },
  { value: 'Stock Problem', labelEn: 'Stock Problem', labelBn: 'স্টক হিসাবের সমস্যা' },
  { value: 'Payment / Subscription', labelEn: 'Payment / Subscription', labelBn: 'পেমেন্ট / সাবস্ক্রিপশন' },
  { value: 'App Error', labelEn: 'App Error / Bug', labelBn: 'অ্যাপ এরর / বাগ' },
  { value: 'Other', labelEn: 'Other Query', labelBn: 'অন্যান্য জিজ্ঞাসা' },
];

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentBusiness,
  initialTab = 'contact',
}) => {
  const [activeTab, setActiveTab] = useState<'contact' | 'report'>(initialTab);
  const [settings, setSettings] = useState<SupportSettings>(() => db.getSupportSettings());

  // Form State
  const [userName, setUserName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<SupportCategory>('Account Problem');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(db.getSupportSettings());
      setActiveTab(initialTab);
      setSubmittedTicketId(null);
      // Autofill details from user/business context
      if (currentUser) {
        setUserName(currentUser.name || '');
        setEmail(currentUser.email || '');
      }
      if (currentBusiness) {
        setBusinessName(currentBusiness.name || '');
      } else if (currentUser?.businessName) {
        setBusinessName(currentUser.businessName);
      }
    }
  }, [isOpen, currentUser, currentBusiness, initialTab]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please select a smaller screenshot image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !email.trim() || !description.trim()) {
      alert('Please fill in your name, email, and problem description.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newTicket = db.createSupportTicket({
        userName: userName.trim(),
        businessName: businessName.trim() || 'Guest / Individual User',
        email: email.trim(),
        category,
        description: description.trim(),
        screenshotUrl,
        userId: currentUser?.id,
        businessId: currentBusiness?.id || currentUser?.businessId || undefined,
      });

      setSubmittedTicketId(newTicket.id);
    } catch (err) {
      console.error('Failed to submit ticket:', err);
      alert('An error occurred submitting your ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedTicketId(null);
    setDescription('');
    setScreenshotUrl(undefined);
  };

  // Build clean WhatsApp link
  const cleanPhone = settings.whatsappNumber.replace(/[^0-9]/g, '');
  const waPresetMsg = encodeURIComponent(
    `${settings.whatsappPresetMessage || 'Hello SPM Support Team, I need help with '} (User: ${userName || 'Customer'})`
  );
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${waPresetMsg}`;

  // Build Mailto link
  const mailtoUrl = `mailto:${settings.supportEmail}?subject=${encodeURIComponent(
    `[SPM Support Request] ${category} - ${businessName || userName || 'User'}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400">
              <LifeBuoy className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Help & Support Center
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  24/7 Available
                </span>
              </div>
              <p className="text-xs text-slate-300">
                সাহায্য ও সহায়তা কেন্দ্র • Connect with Smart Product Manager Support
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 px-6 pt-3 border-b border-slate-200 flex space-x-2">
          <button
            onClick={() => setActiveTab('contact')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'contact'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>Direct Support Links</span>
            <span className="text-[10px] text-slate-400 font-normal">(সরাসরি যোগাযোগ)</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'report'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Report a Problem</span>
            <span className="text-[10px] text-slate-400 font-normal">(সমস্যা রিপোর্ট)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 text-emerald-900 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-emerald-950">We are here to assist your supermarket workspace!</p>
                  <p className="text-emerald-800">
                    আমাদের সাপোর্ট টিম আপনার ব্যবসা সম্পর্কিত যেকোনো জিজ্ঞাসা, সমস্যা বা প্রশিক্ষণে সহায়তা প্রদান করতে প্রস্তুত।
                  </p>
                </div>
              </div>

              {/* 5 Support Channels Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. WhatsApp Support */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3.5 p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 hover:border-emerald-500 hover:shadow-md transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                        WhatsApp Support
                      </h3>
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-600 opacity-70 group-hover:opacity-100" />
                    </div>
                    <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">হোয়াটসঅ্যাপ চ্যাট</p>
                    <p className="text-xs text-slate-600 font-mono mt-1 font-semibold">{settings.whatsappNumber}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Instant messaging & quick technical help</p>
                  </div>
                </a>

                {/* 2. Facebook Messenger Support */}
                <a
                  href={settings.facebookMessengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3.5 p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 hover:border-blue-500 hover:shadow-md transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">
                        Facebook Messenger
                      </h3>
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600 opacity-70 group-hover:opacity-100" />
                    </div>
                    <p className="text-[11px] font-semibold text-blue-700 mt-0.5">মেসেঞ্জার সাপোর্ট</p>
                    <p className="text-xs text-slate-600 font-mono mt-1 truncate">Official Page Support</p>
                    <p className="text-[10px] text-slate-400 mt-1">Send us a direct message on Facebook</p>
                  </div>
                </a>

                {/* 3. Gmail / Email Support */}
                <a
                  href={mailtoUrl}
                  className="flex items-start gap-3.5 p-4 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/40 to-amber-50/30 hover:border-rose-400 hover:shadow-md transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-rose-700 transition-colors">
                        Gmail / Email Support
                      </h3>
                      <ExternalLink className="w-3.5 h-3.5 text-rose-500 opacity-70 group-hover:opacity-100" />
                    </div>
                    <p className="text-[11px] font-semibold text-rose-700 mt-0.5">ইমেইল মাধ্যমে সাহায্য</p>
                    <p className="text-xs text-slate-700 font-mono mt-1 font-semibold truncate">{settings.supportEmail}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Detailed technical queries & reports</p>
                  </div>
                </a>

                {/* 4. Phone Support */}
                <a
                  href={`tel:${settings.supportPhone.replace(/[^0-9+]/g, '')}`}
                  className="flex items-start gap-3.5 p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/60 hover:border-slate-400 hover:shadow-md transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-slate-800 transition-colors">
                        Direct Phone Support
                      </h3>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600 opacity-70 group-hover:opacity-100" />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-700 mt-0.5">জরুরি কল সাপোর্ট</p>
                    <p className="text-xs text-slate-900 font-mono mt-1 font-bold">{settings.supportPhone}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Saturday to Thursday (9 AM - 9 PM)</p>
                  </div>
                </a>
              </div>

              {/* Action Banner to Report Problem */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Facing a specific system issue or bug?</h4>
                    <p className="text-xs text-slate-400">
                      Submit a detailed problem report with optional screenshots for prompt investigation.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('report')}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Report Problem Now</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div>
              {submittedTicketId ? (
                /* Success View */
                <div className="text-center py-8 px-4 space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>

                  <div className="space-y-2">
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-mono font-bold">
                      Ticket Ref: #{submittedTicketId}
                    </span>
                    <h3 className="text-xl font-black text-slate-900">
                      Request Submitted Successfully!
                    </h3>
                    <p className="text-emerald-700 font-bold text-sm sm:text-base max-w-md mx-auto">
                      "Your support request has been submitted successfully. Our support team will contact you."
                    </p>
                    <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed pt-1">
                      আপনার সাপোর্ট রিকোয়েস্টটি আমাদের টেকনিক্যাল টিম রেকর্ড করেছে। ইমেইল (<span className="font-semibold text-slate-700">{email}</span>) অথবা ফোনে শীঘ্রই যোগাযোগ করা হবে।
                    </p>
                  </div>

                  <div className="pt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={handleResetForm}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Submit Another Problem
                    </button>
                    <button
                      onClick={onClose}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Done & Close
                    </button>
                  </div>
                </div>
              ) : (
                /* Problem Report Form */
                <form onSubmit={handleSubmitReport} className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Please provide accurate information so our support team can resolve your inquiry quickly.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* User Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        User Name <span className="text-rose-500">*</span>
                        <span className="text-slate-400 font-normal ml-1">(আপনার নাম)</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="e.g. Imran Mahmud"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>

                    {/* Business/Store Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Business / Store Name
                        <span className="text-slate-400 font-normal ml-1">(প্রতিষ্ঠানের নাম)</span>
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Metro Supermarket"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Address <span className="text-rose-500">*</span>
                        <span className="text-slate-400 font-normal ml-1">(ইমেইল অ্যাড্রেস)</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. owner@example.com"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Problem Category <span className="text-rose-500">*</span>
                        <span className="text-slate-400 font-normal ml-1">(সমস্যার ধরন)</span>
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as SupportCategory)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.labelEn} — ({cat.labelBn})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Problem Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Problem Description <span className="text-rose-500">*</span>
                      <span className="text-slate-400 font-normal ml-1">(সমস্যার বিস্তারিত বর্ণনা)</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please describe the issue in detail (e.g., what happened, error message, steps to reproduce)..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <div className="text-[10px] text-slate-400 text-right mt-1">
                      {description.length} characters
                    </div>
                  </div>

                  {/* Optional Screenshot Upload */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Optional Screenshot Upload
                      <span className="text-slate-400 font-normal ml-1">(স্ক্রিনশট আপলোড - ঐচ্ছিক)</span>
                    </label>

                    {screenshotUrl ? (
                      <div className="relative rounded-xl border border-slate-300 bg-slate-50 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img
                            src={screenshotUrl}
                            alt="Screenshot Preview"
                            className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-xs"
                          />
                          <div className="text-xs">
                            <p className="font-bold text-slate-800">Screenshot Attached</p>
                            <p className="text-[10px] text-slate-500">Ready to upload with ticket</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setScreenshotUrl(undefined)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Remove Screenshot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-bold text-slate-700">Click to upload screenshot</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP up to 5MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmitting ? 'Submitting Report...' : 'Submit Support Request'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
