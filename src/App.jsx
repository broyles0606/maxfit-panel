import React, { useEffect, useMemo, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
)

const app = hasFirebaseConfig ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig)) : null
const db = app ? getFirestore(app) : null

const initialMembers = [
  { id: 1, name: 'Ahmet Yılmaz', phone: '05071234567', plan: 'Aylık', startDate: '2026-03-01', endDate: '2026-04-01', balance: 0, debt: 0 },
  { id: 2, name: 'Mehmet Kaya', phone: '05335557788', plan: '3 Aylık', startDate: '2026-01-15', endDate: '2026-04-15', balance: 300, debt: 0 },
  { id: 3, name: 'Zeynep Demir', phone: '05448889900', plan: 'Aylık', startDate: '2026-02-01', endDate: '2026-03-01', balance: 0, debt: 250 },
]

const initialPayments = [
  { id: 1, memberName: 'Ahmet Yılmaz', amount: 1200, date: '2026-03-01' },
  { id: 2, memberName: 'Mehmet Kaya', amount: 3000, date: '2026-01-15' },
  { id: 3, memberName: 'Zeynep Demir', amount: 950, date: '2026-02-01' },
]

const initialSettings = {
  salonName: 'MAXFİT GYM',
  systemUsername: 'maxfit',
  systemPassword: '1453',
  salonWhatsapp: '05071370669',
}

const STORAGE_KEY = 'maxfit-web-panel-data-v1'
const CLOUD_DOC_ID = 'main'

function formatWhatsapp(phone) {
  const clean = (phone || '').replace(/\D/g, '')
  if (clean.startsWith('90')) return clean
  if (clean.startsWith('0')) return `90${clean.slice(1)}`
  return clean
}

function isActive(endDate) {
  const end = new Date(endDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end >= today
}

function readLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { members: initialMembers, payments: initialPayments, settings: initialSettings }
  try {
    const parsed = JSON.parse(raw)
    return {
      members: parsed.members || initialMembers,
      payments: parsed.payments || initialPayments,
      settings: { ...initialSettings, ...(parsed.settings || {}) },
    }
  } catch {
    return { members: initialMembers, payments: initialPayments, settings: initialSettings }
  }
}

async function readCloudData() {
  if (!db) return null
  const ref = doc(db, 'maxfitPanel', CLOUD_DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    members: data.members || initialMembers,
    payments: data.payments || initialPayments,
    settings: { ...initialSettings, ...(data.settings || {}) },
  }
}

async function writeCloudData(payload) {
  if (!db) return
  const ref = doc(db, 'maxfitPanel', CLOUD_DOC_ID)
  await setDoc(ref, payload, { merge: true })
}

function StatCard({ title, value }) {
  return (
    <div className="card stat-card">
      <div className="muted">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

export default function App() {
  const initial = readLocalData()
  const [booting, setBooting] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tab, setTab] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState(initial.settings)
  const [members, setMembers] = useState(initial.members)
  const [payments, setPayments] = useState(initial.payments)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saveState, setSaveState] = useState('')
  const [form, setForm] = useState({
    name: '', phone: '', plan: 'Aylık', startDate: '', endDate: '', balance: 0, debt: 0,
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (hasFirebaseConfig) {
          const cloud = await readCloudData()
          if (cloud && mounted) {
            setSettings(cloud.settings)
            setMembers(cloud.members)
            setPayments(cloud.payments)
          }
        }
      } finally {
        if (mounted) setBooting(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (booting) return
    const payload = { settings, members, payments }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    if (hasFirebaseConfig) {
      setSaveState('Kaydediliyor...')
      writeCloudData(payload)
        .then(() => setSaveState('Buluta kaydedildi'))
        .catch(() => setSaveState('Yerel kayıt yapıldı'))
        .finally(() => setTimeout(() => setSaveState(''), 1800))
    }
  }, [settings, members, payments, booting])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      total: members.length,
      active: members.filter((m) => isActive(m.endDate)).length,
      expired: members.filter((m) => !isActive(m.endDate)).length,
      todayIncome: payments.filter((p) => p.date === today).reduce((a, b) => a + Number(b.amount || 0), 0),
      monthIncome: payments.filter((p) => p.date.startsWith(today.slice(0, 7))).reduce((a, b) => a + Number(b.amount || 0), 0),
    }
  }, [members, payments])

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return members
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.plan.toLowerCase().includes(q))
  }, [members, search])

  const openNewMember = () => {
    setEditingId(null)
    setForm({ name: '', phone: '', plan: 'Aylık', startDate: '', endDate: '', balance: 0, debt: 0 })
    setShowModal(true)
  }

  const openEditMember = (member) => {
    setEditingId(member.id)
    setForm({ ...member })
    setShowModal(true)
  }

  const saveMember = () => {
    if (!form.name || !form.phone) {
      alert('Ad soyad ve telefon zorunludur.')
      return
    }
    const payload = { ...form, balance: Number(form.balance || 0), debt: Number(form.debt || 0) }
    if (editingId) {
      setMembers((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...payload } : m)))
    } else {
      setMembers((prev) => [{ id: Date.now(), ...payload }, ...prev])
    }
    setShowModal(false)
  }

  const deleteMember = (id) => {
    if (!window.confirm('Üyeyi silmek istiyor musunuz?')) return
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  const addPayment = (member) => {
    const amountText = window.prompt(`${member.name} için ödeme tutarı girin:`)
    if (!amountText) return
    const amount = Number(amountText)
    if (Number.isNaN(amount)) {
      alert('Geçerli bir tutar girin.')
      return
    }
    setPayments((prev) => [{ id: Date.now(), memberName: member.name, amount, date: new Date().toISOString().slice(0, 10) }, ...prev])
  }

  const login = () => {
    if (username === settings.systemUsername && password === settings.systemPassword) {
      setIsLoggedIn(true)
    } else {
      alert('Kullanıcı adı veya şifre hatalı.')
    }
  }

  if (booting) {
    return <div className="center-screen">Panel yükleniyor...</div>
  }

  if (!isLoggedIn) {
    return (
      <div className="center-screen page-bg">
        <div className="card login-card">
          <div className="brand">MAXFİT GYM</div>
          <div className="subtitle">Web Yönetim Paneli</div>
          <label>Kullanıcı Adı</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="maxfit" />
          <label>Şifre</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="1453" />
          <button className="primary-btn" onClick={login}>Giriş Yap</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-bg app-shell">
      <header className="topbar">
        <div>
          <div className="brand">{settings.salonName}</div>
          <div className="subtitle">Profesyonel web yönetim paneli</div>
        </div>
        <div className="topbar-right">
          {saveState ? <span className="badge">{saveState}</span> : null}
          <span className="badge yellow">Kullanıcı: {settings.systemUsername}</span>
          <button className="ghost-btn" onClick={() => setIsLoggedIn(false)}>Çıkış</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'dashboard' ? 'tab active' : 'tab'} onClick={() => setTab('dashboard')}>Ana Sayfa</button>
        <button className={tab === 'members' ? 'tab active' : 'tab'} onClick={() => setTab('members')}>Üyeler</button>
        <button className={tab === 'payments' ? 'tab active' : 'tab'} onClick={() => setTab('payments')}>Ödemeler</button>
        <button className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}>Ayarlar</button>
      </nav>

      {tab === 'dashboard' && (
        <section>
          <div className="stats-grid">
            <StatCard title="Toplam Üye" value={stats.total} />
            <StatCard title="Aktif Üye" value={stats.active} />
            <StatCard title="Süresi Biten" value={stats.expired} />
            <StatCard title="Bugünkü Kazanç" value={`${stats.todayIncome} ₺`} />
          </div>
          <div className="two-col">
            <div className="card">
              <h3>Yakında Süresi Bitecek Üyeler</h3>
              <div className="list-stack">
                {members.slice(0, 5).map((m) => (
                  <div className="list-item" key={m.id}>
                    <div>
                      <strong>{m.name}</strong>
                      <div className="muted">Bitiş: {m.endDate}</div>
                    </div>
                    <span className={isActive(m.endDate) ? 'status active' : 'status expired'}>
                      {isActive(m.endDate) ? 'Aktif' : 'Süresi Bitti'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>Hızlı İşlemler</h3>
              <div className="action-stack">
                <button className="primary-btn" onClick={openNewMember}>Yeni Üye Ekle</button>
                <button className="ghost-btn full" onClick={() => setTab('members')}>Üyeleri Aç</button>
                <a className="success-link" href={`https://wa.me/${formatWhatsapp(settings.salonWhatsapp)}`} target="_blank" rel="noreferrer">Salon WhatsApp</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'members' && (
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Üye Yönetimi</h3>
              <div className="muted">Toplam {filteredMembers.length} üye listeleniyor.</div>
            </div>
            <div className="header-actions">
              <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İsim veya telefon ara" />
              <button className="primary-btn" onClick={openNewMember}>Üye Ekle</button>
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
                {filteredMembers.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.phone}</td>
                    <td>{m.plan}</td>
                    <td><span className={isActive(m.endDate) ? 'status active' : 'status expired'}>{m.endDate}</span></td>
                    <td>{m.balance} ₺</td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-btn blue" onClick={() => openEditMember(m)}>Düzenle</button>
                        <a className="mini-link green" href={`https://wa.me/${formatWhatsapp(m.phone)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                        <button className="mini-btn yellow" onClick={() => addPayment(m)}>Ödeme</button>
                        <button className="mini-btn red" onClick={() => deleteMember(m.id)}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'payments' && (
        <section>
          <div className="stats-grid two-stats">
            <StatCard title="Aylık Kazanç" value={`${stats.monthIncome} ₺`} />
            <StatCard title="Toplam Ödeme Kaydı" value={payments.length} />
          </div>
          <div className="card">
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
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.memberName}</td>
                      <td>{p.amount} ₺</td>
                      <td>{p.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === 'settings' && (
        <section className="settings-grid">
          <div className="card">
            <h3>Salon Ayarları</h3>
            <label>Salon Adı</label>
            <input value={settings.salonName} onChange={(e) => setSettings((s) => ({ ...s, salonName: e.target.value }))} />
            <label>WhatsApp Numarası</label>
            <input value={settings.salonWhatsapp} onChange={(e) => setSettings((s) => ({ ...s, salonWhatsapp: e.target.value }))} />
            <div className="muted small">0507... yazabilirsiniz. Sistem otomatik 90 formatına çevirir.</div>
            <label>Kullanıcı Adı</label>
            <input value={settings.systemUsername} onChange={(e) => setSettings((s) => ({ ...s, systemUsername: e.target.value }))} />
            <label>Şifre</label>
            <input value={settings.systemPassword} onChange={(e) => setSettings((s) => ({ ...s, systemPassword: e.target.value }))} />
            <div className="row-actions top-gap">
              <button className="primary-btn">Ayarları Kaydet</button>
              <a className="ghost-link" href={`https://wa.me/${formatWhatsapp(settings.salonWhatsapp)}`} target="_blank" rel="noreferrer">Salon WhatsApp Aç</a>
            </div>
          </div>

          <div className="card">
            <h3>Bulut Bağlantı Durumu</h3>
            <p>Durum: {hasFirebaseConfig ? 'Firebase bağlı' : 'Şu anda yerel kayıt modu'}</p>
            <p className="muted">Firebase anahtarlarını girince üyeler, ödemeler ve ayarlar buluta kaydolur.</p>
          </div>
        </section>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Üye Düzenle' : 'Yeni Üye Ekle'}</h3>
            <div className="form-grid">
              <div>
                <label>Ad Soyad</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label>Telefon</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label>Paket</label>
                <input value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
              </div>
              <div>
                <label>Bakiye</label>
                <input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
              </div>
              <div>
                <label>Başlangıç</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label>Bitiş</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="full-width">
                <label>Borç</label>
                <input type="number" value={form.debt} onChange={(e) => setForm({ ...form, debt: e.target.value })} />
              </div>
            </div>
            <div className="row-actions top-gap">
              <button className="ghost-btn" onClick={() => setShowModal(false)}>İptal</button>
              <button className="primary-btn" onClick={saveMember}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
