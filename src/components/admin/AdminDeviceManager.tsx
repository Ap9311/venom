/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { navigateToDomainRoute } from '../../utils/subdomainRouting';
import { 
  getAdminConfig, 
  updateAdminLimit, 
  revokeAdminDevice, 
  getAdminDeviceId, 
  getAssistantCredentialsMeta,
  updateAssistantCredentials,
  resetAssistantCredentials,
  AdminDevice 
} from '../../utils/adminAuth';
import { getDeviceImei } from '../../utils/ip';
import { 
  ShieldCheck, 
  Cpu, 
  Smartphone, 
  Laptop, 
  Plus, 
  Minus, 
  Trash2, 
  Lock, 
  Unlock, 
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Sliders,
  ExternalLink,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  RotateCcw
} from 'lucide-react';

export const AdminDeviceManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [maxAdmins, setMaxAdmins] = useState(3);
  const [newLimitInput, setNewLimitInput] = useState(3);
  const [registeredDevices, setRegisteredDevices] = useState<AdminDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [currentUserImei, setCurrentUserImei] = useState('');
  
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<AdminDevice | null>(null);

  // Assistant portal credentials management
  const [assistantUsernameDisplay, setAssistantUsernameDisplay] = useState('theakshatpopat');
  const [assistantIsCustom, setAssistantIsCustom] = useState(false);
  const [assistantUpdatedAt, setAssistantUpdatedAt] = useState<string | undefined>(undefined);
  const [assistantUsernameInput, setAssistantUsernameInput] = useState('theakshatpopat');
  const [assistantPasswordInput, setAssistantPasswordInput] = useState('');
  const [showAssistantPassword, setShowAssistantPassword] = useState(false);
  const [savingAssistantCreds, setSavingAssistantCreds] = useState(false);
  const [assistantFeedback, setAssistantFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [currAdminId, currImei, config, assistantMeta] = await Promise.all([
        getAdminDeviceId(),
        getDeviceImei(),
        getAdminConfig(),
        getAssistantCredentialsMeta()
      ]);

      setCurrentDeviceId(currAdminId);
      setCurrentUserImei(currImei);
      setMaxAdmins(config.maxAdmins);
      setNewLimitInput(config.maxAdmins);
      setRegisteredDevices(config.registeredDevices);

      setAssistantUsernameDisplay(assistantMeta.usernameDisplay);
      setAssistantUsernameInput(assistantMeta.usernameDisplay);
      setAssistantIsCustom(assistantMeta.isCustom);
      setAssistantUpdatedAt(assistantMeta.updatedAt);
    } catch (err) {
      console.error('Failed to load admin device configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveAssistantCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssistantFeedback(null);
    setSavingAssistantCreds(true);

    try {
      const res = await updateAssistantCredentials(assistantUsernameInput, assistantPasswordInput);
      if (res.success) {
        setAssistantUsernameDisplay(res.usernameDisplay || assistantUsernameInput.trim());
        setAssistantIsCustom(true);
        setAssistantUpdatedAt(res.updatedAt);
        setAssistantPasswordInput('');
        setAssistantFeedback({
          type: 'success',
          message: `Assistant portal credentials updated for "${res.usernameDisplay}". Takes effect immediately on next login.`
        });
        setTimeout(() => setAssistantFeedback(null), 5000);
      } else {
        setAssistantFeedback({
          type: 'error',
          message: res.error || 'Failed to update assistant credentials.'
        });
      }
    } catch (err: any) {
      setAssistantFeedback({
        type: 'error',
        message: err?.message || 'Error updating assistant credentials.'
      });
    } finally {
      setSavingAssistantCreds(false);
    }
  };

  const handleResetAssistantCredentials = async () => {
    setAssistantFeedback(null);
    setSavingAssistantCreds(true);
    try {
      const ok = await resetAssistantCredentials();
      if (ok) {
        setAssistantUsernameDisplay('theakshatpopat');
        setAssistantUsernameInput('theakshatpopat');
        setAssistantIsCustom(false);
        setAssistantUpdatedAt(undefined);
        setAssistantPasswordInput('');
        setAssistantFeedback({
          type: 'success',
          message: 'Assistant portal credentials restored to default configuration.'
        });
        setTimeout(() => setAssistantFeedback(null), 5000);
      } else {
        setAssistantFeedback({
          type: 'error',
          message: 'Failed to restore default assistant credentials.'
        });
      }
    } finally {
      setSavingAssistantCreds(false);
    }
  };

  const handleUpdateLimit = async () => {
    if (newLimitInput < registeredDevices.length) {
      setActionError(`Limit cannot be less than currently registered admin devices (${registeredDevices.length}).`);
      return;
    }

    try {
      setUpdatingLimit(true);
      setActionError(null);
      setActionSuccess(null);

      const ok = await updateAdminLimit(newLimitInput);
      if (ok) {
        setMaxAdmins(newLimitInput);
        setActionSuccess(`Admin limit successfully updated to ${newLimitInput}. /login page is now dynamically adjusted.`);
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError('Failed to update admin limit in database.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error updating limit.');
    } finally {
      setUpdatingLimit(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!deviceToRevoke) return;

    try {
      const isSelf = deviceToRevoke.adminDeviceId === currentDeviceId;
      const ok = await revokeAdminDevice(deviceToRevoke.adminDeviceId);
      if (ok) {
        setActionSuccess(`Device ${deviceToRevoke.adminDeviceId} revoked. Slot has been freed.`);
        setDeviceToRevoke(null);
        if (isSelf) {
          navigateToDomainRoute('/');
          return;
        }
        await fetchConfig();
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError('Failed to revoke device.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error revoking device.');
    }
  };

  const registeredCount = registeredDevices.length;
  const isGateLocked = registeredCount >= maxAdmins;
  const slotsRemaining = Math.max(0, maxAdmins - registeredCount);

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 md:p-6 shadow-2xl space-y-6 relative overflow-hidden">
      
      {/* Background glow accent */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-widest text-zinc-100 uppercase flex items-center gap-2">
              Admin Identity & Gate Security
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono tracking-tight mt-0.5">
              Dual Hardware Fingerprint Management & Dynamic /login Access Gate
            </p>
          </div>
        </div>

        <button
          onClick={fetchConfig}
          disabled={loading}
          className="self-start sm:self-center px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh State</span>
        </button>
      </div>

      {/* Feedback alerts */}
      {actionSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Dual Identity of Current Device */}
      <div className="bg-zinc-900/60 border border-zinc-850 rounded-xl p-4 space-y-3">
        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
          Current Device Hardware Identifiers
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
              1. User Device Identity (IMEI)
            </span>
            <div className="text-zinc-200 font-bold tracking-wider text-sm select-all">
              {currentUserImei || 'Calculating...'}
            </div>
            <span className="text-[9px] text-zinc-600 block">
              Permanent hardware key for user feed activity, likes, and communities.
            </span>
          </div>

          <div className="bg-zinc-950/80 border border-emerald-500/20 rounded-lg p-3 space-y-1">
            <span className="text-[10px] text-emerald-500/80 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              2. Admin Hardware Identity (Admin ID)
            </span>
            <div className="text-emerald-400 font-bold tracking-wider text-sm select-all">
              {currentDeviceId || 'Calculating...'}
            </div>
            <span className="text-[9px] text-emerald-500/60 block">
              Permanent hardware key granting cryptographic administrative clearance.
            </span>
          </div>
        </div>
      </div>

      {/* Gate Status & Dynamic Limit Control */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Gate Status Card */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                /login Access Gate Status
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1.5 ${
                isGateLocked 
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {isGateLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {isGateLocked ? 'LOCKED' : 'OPEN'}
              </span>
            </div>

            <div className="text-lg font-black tracking-wide text-zinc-200">
              {registeredCount} / {maxAdmins} Admin Devices Registered
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed mt-2">
              {isGateLocked ? (
                <span className="text-rose-400/90 font-mono">
                  All {maxAdmins} admin slots filled. Anyone navigating to /login or /admin without an admin identity sees the authentic <strong>DNS_PROBE_FINISHED_NXDOMAIN</strong> browser error page.
                </span>
              ) : (
                <span className="text-emerald-400/90 font-mono">
                  {slotsRemaining} slot{slotsRemaining > 1 ? 's' : ''} available. The /login page is currently accessible for authorized new devices until all {maxAdmins} slots are filled.
                </span>
              )}
            </p>
          </div>

          {/* Capacity Progress Bar */}
          <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
            <div 
              className={`h-full transition-all duration-500 ${
                isGateLocked ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (registeredCount / maxAdmins) * 100)}%` }}
            />
          </div>
        </div>

        {/* Change Admin Limit Card */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Adjust Admin ID Generation Limit
            </span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Need to add another device (e.g. 4th, 5th)? Increase the limit below. Once increased, the <span className="text-zinc-300 font-mono">/login</span> page unlocks immediately until the new slot is filled.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNewLimitInput(Math.max(registeredCount, newLimitInput - 1))}
                disabled={newLimitInput <= registeredCount || updatingLimit}
                className="p-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-zinc-300 disabled:opacity-40 transition-colors cursor-pointer"
                title="Decrease limit"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-center text-sm font-bold font-mono text-emerald-400">
                Limit: {newLimitInput} Devices
              </div>

              <button
                onClick={() => setNewLimitInput(newLimitInput + 1)}
                disabled={updatingLimit}
                className="p-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-zinc-300 transition-colors cursor-pointer"
                title="Increase limit"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleUpdateLimit}
              disabled={updatingLimit || newLimitInput === maxAdmins}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20"
            >
              {updatingLimit ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Updating System Limit...</span>
                </>
              ) : (
                <span>Save New Limit ({newLimitInput})</span>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Assistant Portal Credentials Management */}
      <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 md:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-850 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black tracking-widest text-zinc-100 uppercase flex items-center gap-2 flex-wrap">
                Assistant Portal Credentials
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ONE-TIME SESSION
                </span>
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Portal Route: <span className="text-zinc-300">/@ssist@nt/nup@nel</span> • Ephemeral login only (no Admin ID created)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-zinc-500 uppercase">Active User:</span>
            <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-400 font-bold select-all">
              {assistantUsernameDisplay}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${
              assistantIsCustom
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800'
            }`}>
              {assistantIsCustom ? 'CUSTOM' : 'DEFAULT'}
            </span>
          </div>
        </div>

        {assistantFeedback && (
          <div className={`text-xs p-3 rounded-lg flex items-center gap-2 border ${
            assistantFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            {assistantFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{assistantFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveAssistantCredentials} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[9px] uppercase text-zinc-400 block font-bold font-mono tracking-wider">
              Assistant Username
            </label>
            <div className="relative">
              <UserCheck className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={assistantUsernameInput}
                onChange={(e) => setAssistantUsernameInput(e.target.value)}
                required
                placeholder="Enter assistant username..."
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/40 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 focus:outline-none placeholder-zinc-600 font-mono transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] uppercase text-zinc-400 block font-bold font-mono tracking-wider">
              New Assistant Password
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type={showAssistantPassword ? 'text' : 'password'}
                value={assistantPasswordInput}
                onChange={(e) => setAssistantPasswordInput(e.target.value)}
                required
                placeholder="Enter new assistant password..."
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/40 rounded-lg pl-8 pr-9 py-2 text-xs text-zinc-200 focus:outline-none placeholder-zinc-600 font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowAssistantPassword(!showAssistantPassword)}
                className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                title={showAssistantPassword ? 'Hide password' : 'Show password'}
              >
                {showAssistantPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span className="text-[10px] text-zinc-500 font-mono">
              {assistantUpdatedAt
                ? `Last rotated: ${new Date(assistantUpdatedAt).toLocaleString()}`
                : 'Using initial default assistant credentials until updated.'}
            </span>

            <div className="flex items-center gap-2">
              {assistantIsCustom && (
                <button
                  type="button"
                  onClick={handleResetAssistantCredentials}
                  disabled={savingAssistantCreds}
                  className="px-3 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-[10px] font-bold font-mono uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Default</span>
                </button>
              )}
              <button
                type="submit"
                disabled={savingAssistantCreds}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20"
              >
                {savingAssistantCreds ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Update Assistant Credentials</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Registered Admin Hardware Identifiers List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Registered Admin Hardware Devices ({registeredDevices.length})
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            Immutable Hardware Fingerprints
          </span>
        </div>

        {registeredDevices.length === 0 ? (
          <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl p-8 text-center text-zinc-500 text-xs font-mono">
            No admin devices registered yet. Authenticate at /login to register this device.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {registeredDevices.map((device, index) => {
              const isCurrent = device.adminDeviceId === currentDeviceId;

              return (
                <div 
                  key={device.adminDeviceId}
                  className={`bg-zinc-950 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isCurrent 
                      ? 'border-emerald-500/30 bg-emerald-500/[0.02]' 
                      : 'border-zinc-850 hover:border-zinc-800'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold font-mono text-zinc-200 tracking-wider">
                        {device.label || `Admin Device #${index + 1}`}
                      </span>

                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          THIS DEVICE
                        </span>
                      )}

                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                        {device.os || 'Unknown OS'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[10px] font-mono text-zinc-500">
                      <div>
                        <span className="text-zinc-600">Admin ID: </span>
                        <span className="text-emerald-400 font-bold select-all">{device.adminDeviceId}</span>
                      </div>
                      {device.userImei && (
                        <div>
                          <span className="text-zinc-600">User IMEI: </span>
                          <span className="text-zinc-400 select-all">{device.userImei}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-zinc-600">Registered: </span>
                        <span className="text-zinc-400">
                          {new Date(device.registeredAt).toLocaleDateString()} {new Date(device.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => setDeviceToRevoke(device)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[10px] font-bold font-mono uppercase rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Revoke admin clearance for this hardware signature"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revoke confirmation modal */}
      {deviceToRevoke && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-rose-500/30 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-black uppercase tracking-wider">
                Revoke Administrative Clearance?
              </h3>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              Are you sure you want to revoke admin identity <strong className="text-zinc-200">{deviceToRevoke.adminDeviceId}</strong>?
              Once revoked, this physical device will immediately lose administrative access and will see <strong className="text-rose-400">DNS_PROBE_FINISHED_NXDOMAIN</strong>. This will also free 1 admin slot for registration.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeviceToRevoke(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono uppercase rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeConfirm}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-zinc-950 text-xs font-bold font-mono uppercase rounded transition-colors cursor-pointer"
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDeviceManager;
