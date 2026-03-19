import React, { useEffect, useMemo, useState } from "react";
import {
  Home,
  Users,
  Wallet,
  Settings,
  Phone,
  Search,
  Plus,
  Pencil,
  Trash2,
  Dumbbell,
  Loader2,
  UserRound,
  CalendarDays,
  BadgeDollarSign,
} from "lucide-react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

const app = hasFirebaseConfig
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;

const db = app ? getFirestore(app) : null;

const initialMembers = [
  {
    id: 1,
    name: "Ahmet Yılmaz",
    phone: "05071234567",
    plan: "Aylık",
    startDate: "2026-03-01",
    endDate: "2026-04-01",
    balance: 0,
    debt: 0,
    active: true,
  },
  {
    id: 2,
    name: "Mehmet Kaya",
    phone: "05335557788",
    plan: "3 Aylık",
    startDate: "2026-01-15",
    endDate: "2026-04-15",
    balance: 300,
    debt: 0,
    active: true,
  },
  {
    id: 3,
    name: "Zeynep Demir",
    phone: "05448889900",
    plan: "Aylık",
    startDate: "2026-02-01",
    endDate: "2026-03-01",
    balance: 0,
    debt: 250,
    active: false,
  },
];

const initialPayments = [
  { id: 1, memberName: "Ahmet Yılmaz", amount: 1200, date: "2026-03-01" },
  { id: 2, memberName: "Mehmet Kaya", amount: 3000, date: "2026-01-15" },
  { id: 3, memberName: "Zeynep Demir", amount: 950, date: "2026-02-01" },
];

const initialSettings = {
  salonName: "MAXFİT GYM",
  systemUsername: "maxfit",
  systemPassword: "1453",
  salonWhatsapp: "05071370669",
  packagePrices: {
    "Aylık": 1200,
    "3 Aylık": 3000,
    "6 Aylık": 5500,
    "Yıllık": 9000,
  },
};

const STORAGE_KEY = "maxfit-web-panel-data-v5";
const CLOUD_DOC_ID = "main";

function formatWhatsapp(phone) {
  const clean = (phone || "").replace(/\D/g, "");
  if (clean.startsWith("90")) return clean;
  if (clean.startsWith("0")) return `90${clean.slice(1)}`;
  return clean;
}

function statusFromEndDate(endDate) {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end >= today;
}

function calculateEndDate(startDate, plan) {
  if (!startDate) return "";
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return "";

  const monthsMap = {
    "Aylık": 1,
    "3 Aylık": 3,
    "6 Aylık": 6,
    "Yıllık": 12,
  };

  date.setMonth(date.getMonth() + (monthsMap[plan] || 1));
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return `${Number(value || 0)} ₺`;
}

function readLocalData() {
  if (typeof window === "undefined") {
    return {
      members: initialMembers,
      payments: initialPayments,
      settings: initialSettings,
    };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      members: initialMembers,
      payments: initialPayments,
      settings: initialSettings,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      members: parsed.members || initialMembers,
      payments: parsed.payments || initialPayments,
      settings: {
        ...initialSettings,
        ...(parsed.settings || {}),
        packagePrices: {
          ...initialSettings.packagePrices,
          ...((parsed.settings || {}).packagePrices || {}),
        },
      },
    };
  } catch {
    return {
      members: initialMembers,
      payments: initialPayments,
      settings: initialSettings,
    };
  }
}

async function readCloudData() {
  if (!db) return null;
  const ref = doc(db, "maxfitPanel", CLOUD_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();

  return {
    members: data.members || initialMembers,
    payments: data.payments || initialPayments,
    settings: {
      ...initialSettings,
      ...(data.settings || {}),
      packagePrices: {
        ...initialSettings.packagePrices,
        ...((data.settings || {}).packagePrices || {}),
      },
    },
  };
}

async function writeCloudData(payload) {
  if (!db) return;
  const ref = doc(db, "maxfitPanel", CLOUD_DOC_ID);
  await setDoc(ref, payload, { merge: true });
}

function StatCard({ title, value }) {
  return (
    <div className="card stat-card">
      <div className="muted">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button className={active ? "tab active" : "tab"} onClick={onClick}>
      <span className="tab-icon">{icon}</span>
      {children}
    </button>
  );
}

export default function App() {
  const initial = readLocalData();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [settings, setSettings] = useState(initial.settings);
  const [members, setMembers] = useState(initial.members);
  const [payments, setPayments] = useState(initial.payments);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("dashboard");

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    plan: "Aylık",
    startDate: "",
    endDate: "",
    balance: 0,
    debt: 0,
  });

  const packageNames = Object.keys(settings.packagePrices || {});

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        if (hasFirebaseConfig) {
          const cloudData = await readCloudData();
          if (cloudData && mounted) {
            setMembers(cloudData.members);
            setPayments(cloudData.payments);
            setSettings(cloudData.settings);
          }
        }
      } catch (error) {
        console.error("Bulut verisi okunamadı:", error);
      } finally {
        if (mounted) setBooting(false);
      }
    }

    boot();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (booting) return;

    const payload = { members, payments, settings };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    let active = true;
    if (hasFirebaseConfig) {
      setSaving(true);
      writeCloudData(payload)
        .then(() => {
          if (!active) return;
          setSaveMessage("Buluta kaydedildi");
        })
        .catch((error) => {
          console.error("Bulut kayıt hatası:", error);
          if (!active) return;
          setSaveMessage("Yerel kayıt yapıldı");
        })
        .finally(() => {
          if (!active) return;
          setSaving(false);
          setTimeout(() => setSaveMessage(""), 2000);
        });
    }

    return () => {
      active = false;
    };
  }, [members, payments, settings, booting]);

  useEffect(() => {
    if (!form.startDate || !form.plan) return;
    const nextEndDate = calculateEndDate(form.startDate, form.plan);
    if (nextEndDate && nextEndDate !== form.endDate) {
      setForm((prev) => ({ ...prev, endDate: nextEndDate }));
    }
  }, [form.startDate, form.plan, form.endDate]);

  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => statusFromEndDate(m.endDate)).length;
    const expired = members.filter((m) => !statusFromEndDate(m.endDate)).length;
    const today = new Date().toISOString().slice(0, 10);
    const todayIncome = payments
      .filter((p) => p.date === today)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const month = new Date().toISOString().slice(0, 7);
    const monthIncome = payments
      .filter((p) => p.date.startsWith(month))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return { total, active, expired, todayIncome, monthIncome };
  }, [members, payments]);

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.plan.toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleLogin = () => {
    if (username === settings.systemUsername && password === settings.systemPassword) {
      setIsLoggedIn(true);
    } else {
      alert("Kullanıcı adı veya şifre hatalı.");
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      phone: "",
      plan: packageNames[0] || "Aylık",
      startDate: "",
      endDate: "",
      balance: 0,
      debt: 0,
    });
    setEditingMember(null);
  };

  const openNewMember = () => {
    resetForm();
    setShowMemberModal(true);
  };

  const openEditMember = (member) => {
    setEditingMember(member);
    setForm({
      name: member.name,
      phone: member.phone,
      plan: member.plan,
      startDate: member.startDate,
      endDate: member.endDate,
      balance: member.balance,
      debt: member.debt,
    });
    setShowMemberModal(true);
  };

  const saveMember = () => {
    if (!form.name || !form.phone) {
      alert("Ad soyad ve telefon zorunludur.");
      return;
    }

    const computedEndDate = form.endDate || calculateEndDate(form.startDate, form.plan);

    const payload = {
      ...form,
      endDate: computedEndDate,
      balance: Number(form.balance || 0),
      debt: Number(form.debt || 0),
      active: statusFromEndDate(computedEndDate),
    };

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) => (m.id === editingMember.id ? { ...m, ...payload } : m))
      );
    } else {
      setMembers((prev) => [...prev, { id: Date.now(), ...payload }]);
    }

    setShowMemberModal(false);
    resetForm();
  };

  const deleteMember = (id) => {
    if (!window.confirm("Üyeyi silmek istiyor musunuz?")) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const addPaymentForMember = (member) => {
    const amountText = window.prompt(`${member.name} için ödeme tutarı girin:`);
    if (!amountText) return;

    const amount = Number(amountText);
    if (Number.isNaN(amount)) {
      alert("Geçerli bir tutar girin.");
      return;
    }

    setPayments((prev) => [
      {
        id: Date.now(),
        memberName: member.name,
        amount,
        date: new Date().toISOString().slice(0, 10),
      },
      ...prev,
    ]);
  };

  const sendReminderWhatsapp = (member) => {
    const phone = formatWhatsapp(member.phone);
    const message = encodeURIComponent(
      `Merhaba ${member.name}, MAXFİT GYM üyeliğinizin süresi ${member.endDate} tarihinde bitiyor. Yenileme için bizimle iletişime geçebilirsiniz.`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const memberPaymentHistory = (memberName) =>
    payments.filter((payment) => payment.memberName === memberName);

  if (booting) {
    return (
      <div className="center-screen">
        <div className="loader-wrap">
          <Loader2 className="spin-icon" size={28} />
          <span>Panel yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="center-screen page-bg">
        <div className="card login-card">
          <div className="login-brand-wrap">
            <div className="brand-icon">
              <Dumbbell size={24} />
            </div>
            <div>
              <div className="brand">{settings.salonName}</div>
              <div className="subtitle">Web Yönetim Paneli</div>
            </div>
          </div>

          <label>Kullanıcı Adı</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="maxfit"
          />

          <label>Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="1453"
          />

          <button className="primary-btn full" onClick={handleLogin}>
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <div className="app-shell">
        <header className="topbar">
          <div>
            <div className="brand">{settings.salonName}</div>
            <div className="subtitle">Profesyonel web yönetim paneli</div>
          </div>

          <div className="topbar-right">
            {saveMessage ? <span className="badge success">{saveMessage}</span> : null}
            {saving ? <span className="badge warn">Kaydediliyor...</span> : null}
            <span className="badge yellow">Kullanıcı: {settings.systemUsername}</span>
            <button className="ghost-btn" onClick={() => setIsLoggedIn(false)}>
              Çıkış
            </button>
          </div>
        </header>

        <nav className="tabs">
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<Home size={16} />}>
            Ana Sayfa
          </TabButton>
          <TabButton active={tab === "members"} onClick={() => setTab("members")} icon={<Users size={16} />}>
            Üyeler
          </TabButton>
          <TabButton active={tab === "payments"} onClick={() => setTab("payments")} icon={<Wallet size={16} />}>
            Ödemeler
          </TabButton>
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings size={16} />}>
            Ayarlar
          </TabButton>
        </nav>

        {tab === "dashboard" && (
          <>
            <div className="stats-grid">
              <StatCard title="Toplam Üye" value={stats.total} />
              <StatCard title="Aktif Üye" value={stats.active} />
              <StatCard title="Süresi Biten" value={stats.expired} />
              <StatCard title="Bugünkü Kazanç" value={formatCurrency(stats.todayIncome)} />
            </div>

            <div className="two-col">
              <div className="card section-card">
                <h3>Yakında Süresi Bitecek Üyeler</h3>
                <div className="list-stack">
                  {members.slice(0, 5).map((member) => (
                    <div key={member.id} className="list-item">
                      <div>
                        <div className="item-title">{member.name}</div>
                        <div className="muted">Bitiş: {member.endDate}</div>
                      </div>
                      <span className={statusFromEndDate(member.endDate) ? "status active" : "status expired"}>
                        {statusFromEndDate(member.endDate) ? "Aktif" : "Süresi Bitti"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card section-card">
                <h3>Hızlı İşlemler</h3>
                <div className="action-stack">
                  <button className="primary-btn full" onClick={openNewMember}>
                    <Plus size={16} />
                    Yeni Üye Ekle
                  </button>
                  <button className="ghost-btn full" onClick={() => setTab("members")}>
                    <Users size={16} />
                    Üyeleri Aç
                  </button>
                  <a
                    className="success-link full"
                    href={`https://wa.me/${formatWhatsapp(settings.salonWhatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Phone size={16} />
                    Salon WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "members" && (
          <div className="card section-card">
            <div className="section-header">
              <div>
                <h3>Üye Yönetimi</h3>
                <div className="muted">Toplam {filteredMembers.length} üye listeleniyor.</div>
              </div>

              <div className="header-actions">
                <div className="search-wrap">
                  <Search size={16} className="search-icon" />
                  <input
                    className="search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="İsim veya telefon ara"
                  />
                </div>

                <button className="primary-btn" onClick={openNewMember}>
                  <Plus size={16} />
                  Üye Ekle
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ad Soyad</th>
                    <th>Telefon</th>
                    <th>Paket</th>
                    <th>Bitiş</th>
                    <th>Bakiye</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className={
                        statusFromEndDate(member.endDate)
                          ? ""
                          : "expired-row"
                      }
                    >
                      <td>
                        <button className="link-btn" onClick={() => setSelectedMember(member)}>
                          {member.name}
                        </button>
                      </td>
                      <td>{member.phone}</td>
                      <td>{member.plan}</td>
                      <td>
                        <span className={statusFromEndDate(member.endDate) ? "status active" : "status expired"}>
                          {member.endDate}
                        </span>
                      </td>
                      <td>{formatCurrency(member.balance)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="mini-btn blue" onClick={() => openEditMember(member)}>
                            <Pencil size={14} />
                            Düzenle
                          </button>

                          <a
                            className="mini-link green"
                            href={`https://wa.me/${formatWhatsapp(member.phone)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Phone size={14} />
                            WhatsApp
                          </a>

                          <button
                            className="mini-btn orange"
                            onClick={() => sendReminderWhatsapp(member)}
                          >
                            Hatırlat
                          </button>

                          <button
                            className="mini-btn yellow"
                            onClick={() => addPaymentForMember(member)}
                          >
                            <Wallet size={14} />
                            Ödeme
                          </button>

                          <button
                            className="mini-btn red"
                            onClick={() => deleteMember(member.id)}
                          >
                            <Trash2 size={14} />
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "payments" && (
          <>
            <div className="stats-grid two-stats">
              <StatCard title="Aylık Kazanç" value={formatCurrency(stats.monthIncome)} />
              <StatCard title="Toplam Ödeme Kaydı" value={payments.length} />
            </div>

            <div className="card section-card">
              <h3>Ödeme Geçmişi</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Üye</th>
                      <th>Tutar</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.memberName}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{payment.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "settings" && (
          <div className="settings-grid">
            <div className="card section-card">
              <h3>Salon Ayarları</h3>

              <label>Salon Adı</label>
              <input
                value={settings.salonName}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, salonName: e.target.value }))
                }
              />

              <label>WhatsApp Numarası</label>
              <input
                value={settings.salonWhatsapp}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, salonWhatsapp: e.target.value }))
                }
              />
              <div className="muted small">
                0507... yazabilirsiniz. Sistem otomatik 90 formatına çevirir.
              </div>

              <div className="package-editor-grid">
                {packageNames.map((pkg) => (
                  <div className="package-price-card" key={pkg}>
                    <label>{pkg} Fiyatı</label>
                    <input
                      type="number"
                      value={settings.packagePrices?.[pkg] ?? 0}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          packagePrices: {
                            ...(prev.packagePrices || {}),
                            [pkg]: Number(e.target.value || 0),
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <label>Kullanıcı Adı</label>
              <input
                value={settings.systemUsername}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, systemUsername: e.target.value }))
                }
              />

              <label>Şifre</label>
              <input
                value={settings.systemPassword}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, systemPassword: e.target.value }))
                }
              />

              <div className="row-actions top-gap">
                <button className="primary-btn">Ayarları Kaydet</button>
                <a
                  className="ghost-link"
                  href={`https://wa.me/${formatWhatsapp(settings.salonWhatsapp)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Salon WhatsApp Aç
                </a>
              </div>
            </div>

            <div className="card section-card">
              <h3>Bulut Bağlantı Durumu</h3>
              <p>Durum: {hasFirebaseConfig ? "Firebase bağlı" : "Şu anda yerel kayıt modu"}</p>
              <p className="muted">
                Paket fiyatları, üyeler, ödemeler ve ayarlar buluta kaydolur.
              </p>
            </div>
          </div>
        )}
      </div>

      {showMemberModal && (
        <div className="modal-backdrop" onClick={() => setShowMemberModal(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{editingMember ? "Üye Düzenle" : "Yeni Üye Ekle"}</h3>

            <div className="form-grid">
              <div>
                <label>Ad Soyad</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label>Telefon</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div>
                <label>Paket</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                >
                  {packageNames.map((pkg) => (
                    <option key={pkg} value={pkg}>
                      {pkg} - {formatCurrency(settings.packagePrices?.[pkg])}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Bakiye</label>
                <input
                  type="number"
                  value={form.balance}
                  onChange={(e) => setForm({ ...form, balance: e.target.value })}
                />
              </div>

              <div>
                <label>Başlangıç</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>

              <div>
                <label>Bitiş</label>
                <input type="date" value={form.endDate} readOnly />
              </div>

              <div className="full-width">
                <label>Borç</label>
                <input
                  type="number"
                  value={form.debt}
                  onChange={(e) => setForm({ ...form, debt: e.target.value })}
                />
              </div>
            </div>

            <div className="row-actions top-gap">
              <button className="ghost-btn" onClick={() => setShowMemberModal(false)}>
                İptal
              </button>
              <button className="primary-btn" onClick={saveMember}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMember && (
        <div className="modal-backdrop" onClick={() => setSelectedMember(null)}>
          <div className="modal large-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="detail-title">
              <UserRound size={24} />
              <span>{selectedMember.name}</span>
            </div>

            <div className="detail-grid">
              <div className="card inner-card">
                <div className="muted mb10">Üye Bilgileri</div>
                <div className="detail-lines">
                  <div><span className="muted">Telefon:</span> {selectedMember.phone}</div>
                  <div><span className="muted">Paket:</span> {selectedMember.plan}</div>
                  <div><span className="muted">Başlangıç:</span> {selectedMember.startDate}</div>
                  <div><span className="muted">Bitiş:</span> {selectedMember.endDate}</div>
                </div>
              </div>

              <div className="card inner-card">
                <div className="muted mb10">Durum ve Bakiye</div>
                <div className="detail-lines">
                  <div className="inline-row">
                    <CalendarDays size={15} />
                    <span className={statusFromEndDate(selectedMember.endDate) ? "status active" : "status expired"}>
                      {statusFromEndDate(selectedMember.endDate) ? "Aktif" : "Süresi Bitti"}
                    </span>
                  </div>
                  <div><span className="muted">Bakiye:</span> {formatCurrency(selectedMember.balance)}</div>
                  <div><span className="muted">Borç:</span> {formatCurrency(selectedMember.debt)}</div>
                </div>
              </div>

              <div className="card inner-card">
                <div className="muted mb10">Hızlı İşlemler</div>
                <div className="action-stack">
                  <button
                    className="mini-btn blue full"
                    onClick={() => {
                      setSelectedMember(null);
                      openEditMember(selectedMember);
                    }}
                  >
                    <Pencil size={14} />
                    Düzenle
                  </button>

                  <a
                    className="mini-link green full"
                    href={`https://wa.me/${formatWhatsapp(selectedMember.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Phone size={14} />
                    WhatsApp
                  </a>

                  <button
                    className="mini-btn orange full"
                    onClick={() => sendReminderWhatsapp(selectedMember)}
                  >
                    Hatırlatma Gönder
                  </button>

                  <button
                    className="mini-btn yellow full"
                    onClick={() => addPaymentForMember(selectedMember)}
                  >
                    <BadgeDollarSign size={14} />
                    Ödeme Ekle
                  </button>
                </div>
              </div>
            </div>

            <div className="card inner-card top-gap">
              <h3>Ödeme Geçmişi</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tutar</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberPaymentHistory(selectedMember.name).length ? (
                      memberPaymentHistory(selectedMember.name).map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatCurrency(payment.amount)}</td>
                          <td>{payment.date}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="muted">
                          Bu üyeye ait ödeme kaydı bulunmuyor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
