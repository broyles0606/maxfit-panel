import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const STORAGE_KEY = "maxfit-web-panel-data-v4";
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
    <Card className="rounded-3xl border-zinc-800 bg-zinc-900">
      <CardContent className="p-6">
        <p className="text-sm text-zinc-400">{title}</p>
        <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
      </CardContent>
    </Card>
  );
}

export default function MaxfitWebPanel() {
  const initial = readLocalData();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [settings, setSettings] = useState(initial.settings);
  const [members, setMembers] = useState(initial.members);
  const [payments, setPayments] = useState(initial.payments);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  const [openMemberDialog, setOpenMemberDialog] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  const [memberForm, setMemberForm] = useState({
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
        if (mounted) setIsBooting(false);
      }
    }

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isBooting) return;

    const payload = { members, payments, settings };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    let active = true;
    if (hasFirebaseConfig) {
      setIsSaving(true);
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
          setIsSaving(false);
          setTimeout(() => setSaveMessage(""), 2000);
        });
    }

    return () => {
      active = false;
    };
  }, [members, payments, settings, isBooting]);

  useEffect(() => {
    if (!memberForm.startDate || !memberForm.plan) return;
    const nextEndDate = calculateEndDate(memberForm.startDate, memberForm.plan);
    if (nextEndDate && nextEndDate !== memberForm.endDate) {
      setMemberForm((prev) => ({ ...prev, endDate: nextEndDate }));
    }
  }, [memberForm.startDate, memberForm.plan, memberForm.endDate]);

  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => statusFromEndDate(m.endDate)).length;
    const expired = members.filter((m) => !statusFromEndDate(m.endDate)).length;
    const today = new Date().toISOString().slice(0, 10);
    const todayIncome = payments
      .filter((p) => p.date === today)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { total, active, expired, todayIncome };
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

  const monthlyIncome = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return payments
      .filter((p) => p.date.startsWith(month))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  const handleLogin = () => {
    if (username === settings.systemUsername && password === settings.systemPassword) {
      setIsLoggedIn(true);
    } else {
      alert("Kullanıcı adı veya şifre hatalı.");
    }
  };

  const resetForm = () => {
    setMemberForm({
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
    setOpenMemberDialog(true);
  };

  const openEditMember = (member) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      phone: member.phone,
      plan: member.plan,
      startDate: member.startDate,
      endDate: member.endDate,
      balance: member.balance,
      debt: member.debt,
    });
    setOpenMemberDialog(true);
  };

  const saveMember = () => {
    if (!memberForm.name || !memberForm.phone) {
      alert("Ad soyad ve telefon zorunludur.");
      return;
    }

    const computedEndDate =
      memberForm.endDate || calculateEndDate(memberForm.startDate, memberForm.plan);

    const payload = {
      ...memberForm,
      endDate: computedEndDate,
      balance: Number(memberForm.balance || 0),
      debt: Number(memberForm.debt || 0),
      active: statusFromEndDate(computedEndDate),
    };

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) => (m.id === editingMember.id ? { ...m, ...payload } : m))
      );
    } else {
      setMembers((prev) => [...prev, { id: Date.now(), ...payload }]);
    }

    setOpenMemberDialog(false);
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

  if (isBooting) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-lg">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
          Panel yükleniyor...
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-3xl border-zinc-800 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-yellow-400 text-black flex items-center justify-center">
                <Dumbbell className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">{settings.salonName}</CardTitle>
                <p className="text-sm text-zinc-400">Web Yönetim Paneli</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-200">Kullanıcı Adı</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="maxfit"
                className="bg-zinc-950 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-200">Şifre</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className="bg-zinc-950 border-zinc-700 text-white"
              />
            </div>
            <Button onClick={handleLogin} className="w-full rounded-2xl bg-yellow-400 text-black hover:bg-yellow-300">
              Giriş Yap
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{settings.salonName}</h1>
            <p className="text-zinc-400">Profesyonel web yönetim paneli</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {saveMessage ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">
                {saveMessage}
              </Badge>
            ) : null}
            {isSaving ? (
              <Badge className="bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/20">
                Kaydediliyor...
              </Badge>
            ) : null}
            <Badge className="bg-yellow-400 text-black hover:bg-yellow-400">
              Kullanıcı: {settings.systemUsername}
            </Badge>
            <Button variant="outline" className="rounded-2xl border-zinc-700 text-white" onClick={() => setIsLoggedIn(false)}>
              Çıkış
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-zinc-900 p-1">
            <TabsTrigger value="dashboard" className="rounded-xl data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
              <Home className="mr-2 h-4 w-4" />
              Ana Sayfa
            </TabsTrigger>
            <TabsTrigger value="members" className="rounded-xl data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
              <Users className="mr-2 h-4 w-4" />
              Üyeler
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-xl data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
              <Wallet className="mr-2 h-4 w-4" />
              Ödemeler
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
              <Settings className="mr-2 h-4 w-4" />
              Ayarlar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Toplam Üye" value={stats.total} />
              <StatCard title="Aktif Üye" value={stats.active} />
              <StatCard title="Süresi Biten" value={stats.expired} />
              <StatCard title="Bugünkü Kazanç" value={formatCurrency(stats.todayIncome)} />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="rounded-3xl border-zinc-800 bg-zinc-900 xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white">Yakında Süresi Bitecek Üyeler</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {members.slice(0, 5).map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-sm text-zinc-400">Bitiş: {member.endDate}</p>
                      </div>
                      <Badge className={statusFromEndDate(member.endDate) ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>
                        {statusFromEndDate(member.endDate) ? "Aktif" : "Süresi Bitti"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="text-white">Hızlı İşlemler</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={openNewMember} className="w-full rounded-2xl bg-yellow-400 text-black hover:bg-yellow-300">
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Üye Ekle
                  </Button>
                  <Button onClick={() => setActiveTab("members")} variant="outline" className="w-full rounded-2xl border-zinc-700 text-white">
                    <Users className="mr-2 h-4 w-4" />
                    Üyeleri Aç
                  </Button>
                  <a href={`https://wa.me/${formatWhatsapp(settings.salonWhatsapp)}`} target="_blank" rel="noreferrer" className="block">
                    <Button className="w-full rounded-2xl bg-emerald-500 text-white hover:bg-emerald-400">
                      <Phone className="mr-2 h-4 w-4" />
                      Salon WhatsApp
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-6">
            <Card className="rounded-3xl border-zinc-800 bg-zinc-900">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-white">Üye Yönetimi</CardTitle>
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="İsim veya telefon ara"
                      className="w-full rounded-2xl border-zinc-700 bg-zinc-950 pl-9 text-white md:w-72"
                    />
                  </div>
                  <Button onClick={openNewMember} className="rounded-2xl bg-yellow-400 text-black hover:bg-yellow-300">
                    <Plus className="mr-2 h-4 w-4" />
                    Üye Ekle
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 text-sm text-zinc-400">
                  Toplam {filteredMembers.length} üye listeleniyor.
                </div>
                <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-zinc-900">
                        <TableHead className="text-zinc-300">Ad Soyad</TableHead>
                        <TableHead className="text-zinc-300">Telefon</TableHead>
                        <TableHead className="text-zinc-300">Paket</TableHead>
                        <TableHead className="text-zinc-300">Bitiş</TableHead>
                        <TableHead className="text-zinc-300">Bakiye</TableHead>
                        <TableHead className="text-zinc-300">İşlem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => (
                        <TableRow
                          key={member.id}
                          className={
                            statusFromEndDate(member.endDate)
                              ? "border-zinc-800 hover:bg-zinc-950/70"
                              : "border-red-900/40 bg-red-950/20 hover:bg-red-950/30"
                          }
                        >
                          <TableCell className="font-medium text-white">
                            <button onClick={() => setSelectedMember(member)} className="text-left hover:text-yellow-200">
                              {member.name}
                            </button>
                          </TableCell>
                          <TableCell className="text-zinc-300">{member.phone}</TableCell>
                          <TableCell className="text-zinc-300">{member.plan}</TableCell>
                          <TableCell>
                            <Badge className={statusFromEndDate(member.endDate) ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>
                              {member.endDate}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-300">{formatCurrency(member.balance)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => openEditMember(member)} className="rounded-xl bg-blue-600 text-white hover:bg-blue-500">
                                <Pencil className="mr-1 h-4 w-4" />
                                Düzenle
                              </Button>
                              <a href={`https://wa.me/${formatWhatsapp(member.phone)}`} target="_blank" rel="noreferrer">
                                <Button size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500">
                                  <Phone className="mr-1 h-4 w-4" />
                                  WhatsApp
                                </Button>
                              </a>
                              <Button
                                size="sm"
                                onClick={() => sendReminderWhatsapp(member)}
                                className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                              >
                                Hatırlat
                              </Button>
                              <Button size="sm" onClick={() => addPaymentForMember(member)} className="rounded-xl bg-yellow-500 text-black hover:bg-yellow-400">
                                <Wallet className="mr-1 h-4 w-4" />
                                Ödeme
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteMember(member.id)} className="rounded-xl">
                                <Trash2 className="mr-1 h-4 w-4" />
                                Sil
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <StatCard title="Aylık Kazanç" value={formatCurrency(monthlyIncome)} />
              <StatCard title="Toplam Ödeme Kaydı" value={payments.length} />
            </div>
            <Card className="rounded-3xl border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardTitle className="text-white">Ödeme Geçmişi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-zinc-900">
                        <TableHead className="text-zinc-300">Üye</TableHead>
                        <TableHead className="text-zinc-300">Tutar</TableHead>
                        <TableHead className="text-zinc-300">Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id} className="border-zinc-800 hover:bg-zinc-950/70">
                          <TableCell className="text-white">{payment.memberName}</TableCell>
                          <TableCell className="text-zinc-300">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="text-zinc-300">{payment.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="rounded-3xl border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardTitle className="text-white">Salon Ayarları</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-zinc-200">Salon Adı</Label>
                  <Input
                    value={settings.salonName}
                    onChange={(e) => setSettings((prev) => ({ ...prev, salonName: e.target.value }))}
                    className="rounded-2xl border-zinc-700 bg-zinc-950 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-200">WhatsApp Numarası</Label>
                  <Input
                    value={settings.salonWhatsapp}
                    onChange={(e) => setSettings((prev) => ({ ...prev, salonWhatsapp: e.target.value }))}
                    className="rounded-2xl border-zinc-700 bg-zinc-950 text-white"
                  />
                  <p className="text-xs text-zinc-500">
                    0507... yazabilirsiniz. Sistem otomatik 90 formatına çevirir.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-zinc-200">Üyelik Paket Fiyatları</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {packageNames.map((pkg) => (
                      <div key={pkg} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="mb-2 text-sm text-zinc-400">{pkg}</p>
                        <Input
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
                          className="rounded-2xl border-zinc-700 bg-zinc-900 text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-200">Kullanıcı Adı</Label>
                  <Input
                    value={settings.systemUsername}
                    onChange={(e) => setSettings((prev) => ({ ...prev, systemUsername: e.target.value }))}
                    className="rounded-2xl border-zinc-700 bg-zinc-950 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-200">Şifre</Label>
                  <Input
                    value={settings.systemPassword}
                    onChange={(e) => setSettings((prev) => ({ ...prev, systemPassword: e.target.value }))}
                    className="rounded-2xl border-zinc-700 bg-zinc-950 text-white"
                  />
                </div>

                <div className="md:col-span-2 flex gap-3 pt-2 flex-wrap">
                  <Button className="rounded-2xl bg-yellow-400 text-black hover:bg-yellow-300">
                    Ayarları Kaydet
                  </Button>
                  <a href={`https://wa.me/${formatWhatsapp(settings.salonWhatsapp)}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="rounded-2xl border-zinc-700 text-white">
                      Salon WhatsApp Aç
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardTitle className="text-white">Bulut Bağlantı Durumu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-300">
                <p>Durum: {hasFirebaseConfig ? "Firebase bağlı" : "Şu anda yerel kayıt modu"}</p>
                <p>Paket fiyatları, üyeler, ödemeler ve ayarlar buluta kaydolur.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={openMemberDialog} onOpenChange={setOpenMemberDialog}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-white sm:max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Üye Düzenle" : "Yeni Üye Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                className="border-zinc-700 bg-zinc-950 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={memberForm.phone}
                onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                className="border-zinc-700 bg-zinc-950 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Paket</Label>
              <select
                value={memberForm.plan}
                onChange={(e) => setMemberForm({ ...memberForm, plan: e.target.value })}
                className="flex h-10 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 text-white"
              >
                {packageNames.map((pkg) => (
                  <option key={pkg} value={pkg}>
                    {pkg} - {formatCurrency(settings.packagePrices?.[pkg])}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Bakiye</Label>
              <Input
                type="number"
                value={memberForm.balance}
                onChange={(e) => setMemberForm({ ...memberForm, balance: e.target.value })}
                className="border-zinc-700 bg-zinc-950 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Başlangıç</Label>
              <Input
                type="date"
                value={memberForm.startDate}
                onChange={(e) => setMemberForm({ ...memberForm, startDate: e.target.value })}
                className="border-zinc-700 bg-zinc-950 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Bitiş</Label>
              <Input
                type="date"
                value={memberForm.endDate}
                readOnly
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Borç</Label>
              <Input
                type="number"
                value={memberForm.debt}
                onChange={(e) => setMemberForm({ ...memberForm, debt: e.target.value })}
                className="border-zinc-700 bg-zinc-950 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMemberDialog(false)} className="border-zinc-700 text-white">
              İptal
            </Button>
            <Button onClick={saveMember} className="bg-yellow-400 text-black hover:bg-yellow-300">
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-white sm:max-w-3xl rounded-3xl">
          {selectedMember ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <UserRound className="h-6 w-6 text-yellow-400" />
                  {selectedMember.name}
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-3xl border-zinc-800 bg-zinc-950">
                  <CardContent className="p-5">
                    <p className="mb-3 text-sm text-zinc-400">Üye Bilgileri</p>
                    <div className="space-y-3 text-sm">
                      <div><span className="text-zinc-500">Telefon:</span> <span className="text-white">{selectedMember.phone}</span></div>
                      <div><span className="text-zinc-500">Paket:</span> <span className="text-white">{selectedMember.plan}</span></div>
                      <div><span className="text-zinc-500">Başlangıç:</span> <span className="text-white">{selectedMember.startDate}</span></div>
                      <div><span className="text-zinc-500">Bitiş:</span> <span className="text-white">{selectedMember.endDate}</span></div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-zinc-800 bg-zinc-950">
                  <CardContent className="p-5">
                    <p className="mb-3 text-sm text-zinc-400">Durum ve Bakiye</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-yellow-400" />
                        <Badge className={statusFromEndDate(selectedMember.endDate) ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>
                          {statusFromEndDate(selectedMember.endDate) ? "Aktif" : "Süresi Bitti"}
                        </Badge>
                      </div>
                      <div><span className="text-zinc-500">Bakiye:</span> <span className="text-white">{formatCurrency(selectedMember.balance)}</span></div>
                      <div><span className="text-zinc-500">Borç:</span> <span className="text-white">{formatCurrency(selectedMember.debt)}</span></div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-zinc-800 bg-zinc-950">
                  <CardContent className="p-5">
                    <p className="mb-3 text-sm text-zinc-400">Hızlı İşlemler</p>
                    <div className="space-y-2">
                      <Button
                        onClick={() => {
                          setSelectedMember(null);
                          openEditMember(selectedMember);
                        }}
                        className="w-full rounded-2xl bg-blue-600 text-white hover:bg-blue-500"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Düzenle
                      </Button>

                      <a href={`https://wa.me/${formatWhatsapp(selectedMember.phone)}`} target="_blank" rel="noreferrer" className="block">
                        <Button className="w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500">
                          <Phone className="mr-2 h-4 w-4" />
                          WhatsApp
                        </Button>
                      </a>

                      <Button
                        onClick={() => sendReminderWhatsapp(selectedMember)}
                        className="w-full rounded-2xl bg-orange-500 text-white hover:bg-orange-400"
                      >
                        Hatırlatma Gönder
                      </Button>

                      <Button
                        onClick={() => addPaymentForMember(selectedMember)}
                        className="w-full rounded-2xl bg-yellow-500 text-black hover:bg-yellow-400"
                      >
                        <BadgeDollarSign className="mr-2 h-4 w-4" />
                        Ödeme Ekle
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-2 rounded-3xl border-zinc-800 bg-zinc-950">
                <CardHeader>
                  <CardTitle className="text-white">Ödeme Geçmişi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-zinc-900">
                          <TableHead className="text-zinc-300">Tutar</TableHead>
                          <TableHead className="text-zinc-300">Tarih</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberPaymentHistory(selectedMember.name).length ? (
                          memberPaymentHistory(selectedMember.name).map((payment) => (
                            <TableRow key={payment.id} className="border-zinc-800 hover:bg-zinc-950/70">
                              <TableCell className="text-zinc-300">{formatCurrency(payment.amount)}</TableCell>
                              <TableCell className="text-zinc-300">{payment.date}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow className="border-zinc-800">
                            <TableCell className="text-zinc-500" colSpan={2}>
                              Bu üyeye ait ödeme kaydı bulunmuyor.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <Card className="rounded-3xl border-zinc-800 bg-zinc-900">
      <CardContent className="p-6">
        <p className="text-sm text-zinc-400">{title}</p>
        <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
      </CardContent>
    </Card>
  );
}
