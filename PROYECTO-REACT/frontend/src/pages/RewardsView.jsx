import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ViewTitle from '../components/ViewTitle'
import ModalDialog from '../components/ModalDialog'
import { RewardService } from '../services/RewardService'
import { AttendanceService } from '../services/AttendanceService'

// Galería de imágenes predeterminadas para selección rápida
const REWARD_PRESETS = [
  {
    label: 'Bebida Energizante',
    categoria: 'Bebidas e Hidratación',
    imagenUrl: 'https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Kit Botilito & Shaker',
    categoria: 'Indumentaria & Accesorios',
    imagenUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Toalla Microfibra Gym',
    categoria: 'Indumentaria & Accesorios',
    imagenUrl: 'https://images.unsplash.com/photo-1606902965551-dce093cda6e7?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Batido Proteína Whey',
    categoria: 'Suplementos & Nutrición',
    imagenUrl: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Pase Libre para Amigo',
    categoria: 'Servicios & Pases',
    imagenUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Descuento en Mensualidad',
    categoria: 'Servicios & Pases',
    imagenUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Camiseta Panda Oficial',
    categoria: 'Indumentaria & Accesorios',
    imagenUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Barra Proteica Snack',
    categoria: 'Suplementos & Nutrición',
    imagenUrl: 'https://images.unsplash.com/photo-1622484216802-99d98e72750a?auto=format&fit=crop&w=800&q=80',
  },
]

const DEFAULT_CATEGORIES = [
  'Bebidas e Hidratación',
  'Suplementos & Nutrición',
  'Indumentaria & Accesorios',
  'Servicios & Pases',
]

// Parsea el campo imagenUrl que puede ser una URL simple o un array JSON de hasta 5 imágenes
function parseRewardImages(raw) {
  if (!raw) return []
  const str = String(raw).trim()
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed)) {
        return parsed.filter((u) => u && typeof u === 'string' && u.trim() !== '')
      }
    } catch (_) {}
  }
  if (str) return [str]
  return []
}

function getRewardImages(item) {
  const parsed = parseRewardImages(item?.imagenUrl)
  if (parsed.length > 0) return parsed
  const fallback = getFallbackRewardImage(item?.categoria)
  return [fallback]
}

function getRewardImage(item) {
  const imgs = getRewardImages(item)
  return imgs[0] || getFallbackRewardImage(item?.categoria)
}

function getFallbackRewardImage(categoria) {
  const cat = String(categoria || '').toLowerCase()
  if (cat.includes('bebida')) {
    return 'https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=800&q=80'
  }
  if (cat.includes('suplemento') || cat.includes('nutri')) {
    return 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80'
  }
  if (cat.includes('accesorio') || cat.includes('indumentaria') || cat.includes('ropa')) {
    return 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80'
  }
  if (cat.includes('servicio') || cat.includes('pase')) {
    return 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80'
  }
  return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80'
}

function getPartnerImage(partner) {
  if (partner?.imagenUrl && partner.imagenUrl.trim() !== '') return partner.imagenUrl
  return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80'
}

export default function RewardsView({ token, user }) {
  const navigate = useNavigate()
  const isAdmin = user?.rol === 'admin'
  const [activeTab, setActiveTab] = useState('catalogo')
  const [loading, setLoading] = useState(true)

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [rewards, setRewards] = useState([])
  const [partnerships, setPartnerships] = useState([])
  const [myRedemptions, setMyRedemptions] = useState([])
  const [allRedemptions, setAllRedemptions] = useState([])

  const [bambooBalance, setBambooBalance] = useState(240)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })

  const [categories, setCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('panda_custom_categories')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (_) {}
    return DEFAULT_CATEGORIES
  })
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [currentSlide, setCurrentSlide] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)

  const [detailModalItem, setDetailModalItem] = useState(null)
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState(0)
  const [copiedCode, setCopiedCode] = useState(false)
  const [zoomImage, setZoomImage] = useState(null)

  const [showAddRewardModal, setShowAddRewardModal] = useState(false)
  const [newReward, setNewReward] = useState({
    nombre: '',
    descripcion: '',
    costoBambus: 100,
    categoria: DEFAULT_CATEGORIES[0],
    stock: 50,
    images: [],
    destacado: false,
  })
  const [newRewardUrlInput, setNewRewardUrlInput] = useState('')
  const fileInputRefCreate = useRef(null)

  const [editingReward, setEditingReward] = useState(null)
  const [editRewardForm, setEditRewardForm] = useState({
    id: null,
    nombre: '',
    descripcion: '',
    costoBambus: 100,
    categoria: DEFAULT_CATEGORIES[0],
    stock: 50,
    images: [],
    destacado: false,
  })
  const [editRewardUrlInput, setEditRewardUrlInput] = useState('')
  const fileInputRefEdit = useRef(null)

  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false)
  const [newPartner, setNewPartner] = useState({
    aliadoNombre: '',
    categoria: 'Nutrición y Suplementos',
    descuentoTexto: '20% de Descuento',
    descripcion: '',
    codigoPromocional: 'PANDA20',
    imagenUrl: '',
    destacado: false,
  })

  const [claimedReward, setClaimedReward] = useState(null)
  const [createRewardErrors, setCreateRewardErrors] = useState({})
  const [editRewardErrors, setEditRewardErrors] = useState({})
  const [partnerErrors, setPartnerErrors] = useState({})

  useEffect(() => {
    loadAllData()
  }, [])

  async function loadAllData() {
    setLoading(true)
    try {
      const pandaRes = await AttendanceService.getPandaStatus(token).catch(() => null)
      if (pandaRes && pandaRes.bambusDisponibles !== undefined) {
        setBambooBalance(pandaRes.bambusDisponibles)
      }

      const recRes = await RewardService.getRewards(token).catch(() => null)
      if (recRes && recRes.rewards) {
        setRewards(recRes.rewards)
      } else {
        setRewards([
          {
            id: 1,
            nombre: 'Bebida Isotónica Energizante',
            descripcion: 'Hidratación inmediata con electrolitos y sales minerales en la cafetería del club.',
            costoBambus: 80,
            categoria: 'Bebidas e Hidratación',
            stock: 45,
            destacado: 1,
            imagenUrl: 'https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=800&q=80',
          },
          {
            id: 2,
            nombre: 'Kit de Bienvenida Panda',
            descripcion: 'Botilito ergonómico de 750ml libre de BPA y pulsera deportiva oficial Panda Fitness.',
            costoBambus: 100,
            categoria: 'Indumentaria & Accesorios',
            stock: 20,
            destacado: 1,
            imagenUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
          },
          {
            id: 3,
            nombre: 'Toalla Deportiva Microfibra',
            descripcion: 'Toalla ultra absorbente de secado rápido con logo bordado Panda Fitness para tus rutinas.',
            costoBambus: 150,
            categoria: 'Indumentaria & Accesorios',
            stock: 35,
            destacado: 0,
            imagenUrl: 'https://images.unsplash.com/photo-1606902965551-dce093cda6e7?auto=format&fit=crop&w=800&q=80',
          },
          {
            id: 4,
            nombre: 'Shake de Proteína Premium 25g',
            descripcion: 'Batido cremoso de proteína aislada whey con frutas frescas en la barra deportiva del club.',
            costoBambus: 200,
            categoria: 'Suplementos & Nutrición',
            stock: 50,
            destacado: 1,
            imagenUrl: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80',
          },
          {
            id: 5,
            nombre: 'Pase Libre de 1 Día para Amigo',
            descripcion: 'Permite que un amigo entrene un día completo contigo con acceso total a máquinas y clases.',
            costoBambus: 300,
            categoria: 'Servicios & Pases',
            stock: 25,
            destacado: 0,
            imagenUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
          },
          {
            id: 6,
            nombre: '15% Descuento en Renovación',
            descripcion: 'Descuento directo aplicable en tu próxima cuota mensual o renovación de membresía trimestral.',
            costoBambus: 500,
            categoria: 'Servicios & Pases',
            stock: 15,
            destacado: 0,
            imagenUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
          },
        ])
      }

      const partRes = await RewardService.getPartnerships(token).catch(() => null)
      if (partRes && partRes.partnerships) {
        setPartnerships(partRes.partnerships)
      } else {
        setPartnerships([
          {
            id: 1,
            aliadoNombre: 'Optimum Nutrition Store',
            categoria: 'Nutrición y Suplementos',
            descuentoTexto: '20% de Descuento',
            descripcion: 'En proteínas whey, creatinas y pre-entrenos presentando tu membresía activa.',
            codigoPromocional: 'PANDANUTRITION20',
            destacado: 1,
            imagenUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80',
          },
          {
            id: 2,
            aliadoNombre: 'Clínica Fisiocare',
            categoria: 'Salud & Fisioterapia',
            descuentoTexto: '30% en Descarga Muscular',
            descripcion: 'Sesiones de recuperación muscular profunda, punción seca y masajes descontracturantes.',
            codigoPromocional: 'PANDAFISIO30',
            destacado: 1,
            imagenUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
          },
          {
            id: 3,
            aliadoNombre: 'SportStyle Indumentaria',
            categoria: 'Ropa Deportiva',
            descuentoTexto: '15% en Toda la Tienda',
            descripcion: 'Prendas transpirables, zapatillas de running y accesorios de compresión de alta calidad.',
            codigoPromocional: 'PANDASTYLE15',
            destacado: 0,
            imagenUrl: 'https://images.unsplash.com/photo-1483721074574-2454b51a8069?auto=format&fit=crop&w=800&q=80',
          },
          {
            id: 4,
            aliadoNombre: 'GreenBowl Saludable',
            categoria: 'Gastronomía Saludable',
            descuentoTexto: '25% en Platos y Ensaladas',
            descripcion: 'Almuerzos altos en proteína y wraps saludables a sólo 2 cuadras de Panda Fitness.',
            codigoPromocional: 'PANDAGREEN25',
            destacado: 0,
            imagenUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
          },
        ])
      }

      const myRedRes = await RewardService.getMyRedemptions(token).catch(() => null)
      if (myRedRes && myRedRes.redemptions) {
        setMyRedemptions(myRedRes.redemptions)
      }

      if (isAdmin) {
        const allRedRes = await RewardService.getAllRedemptions(token).catch(() => null)
        if (allRedRes && allRedRes.redemptions) {
          setAllRedemptions(allRedRes.redemptions)
        }
      }
    } catch {
      // Manejo silencioso
    } finally {
      setLoading(false)
    }
  }

  const carouselItems = useMemo(() => {
    const featuredRewards = rewards
      .filter((r) => r.destacado)
      .map((r) => ({
        id: 'rew-' + r.id,
        type: 'reward',
        badge: 'RECOMPENSA DESTACADA',
        badgeIcon: 'bi-stars',
        badgeBg: '#c4f039',
        badgeColor: '#111d15',
        title: r.nombre,
        subtitle: r.costoBambus + ' BAMBÚS',
        desc: r.descripcion,
        imageUrl: getRewardImage(r),
        rawItem: r,
      }))

    const featuredPartners = partnerships
      .filter((p) => p.destacado)
      .map((p) => ({
        id: 'part-' + p.id,
        type: 'partner',
        badge: 'CONVENIO EXCLUSIVO',
        badgeIcon: 'bi-shop',
        badgeBg: '#38bdf8',
        badgeColor: '#0c4a6e',
        title: p.aliadoNombre,
        subtitle: p.descuentoTexto,
        desc: p.descripcion,
        imageUrl: getPartnerImage(p),
        rawItem: p,
      }))

    let combined = [...featuredRewards, ...featuredPartners]
    if (combined.length === 0) {
      const topRewards = rewards.slice(0, 3).map((r) => ({
        id: 'rew-' + r.id,
        type: 'reward',
        badge: 'RECOMPENSA CLUB',
        badgeIcon: 'bi-gift-fill',
        badgeBg: '#c4f039',
        badgeColor: '#111d15',
        title: r.nombre,
        subtitle: r.costoBambus + ' BAMBÚS',
        desc: r.descripcion,
        imageUrl: getRewardImage(r),
        rawItem: r,
      }))
      const topPartners = partnerships.slice(0, 2).map((p) => ({
        id: 'part-' + p.id,
        type: 'partner',
        badge: 'BENEFICIO ALIADO',
        badgeIcon: 'bi-handshake-fill',
        badgeBg: '#38bdf8',
        badgeColor: '#0c4a6e',
        title: p.aliadoNombre,
        subtitle: p.descuentoTexto,
        desc: p.descripcion,
        imageUrl: getPartnerImage(p),
        rawItem: p,
      }))
      combined = [...topRewards, ...topPartners]
    }
    return combined
  }, [rewards, partnerships])

  useEffect(() => {
    if (carouselItems.length <= 1 || isCarouselPaused) return
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselItems.length)
    }, 4200)
    return () => clearInterval(interval)
  }, [carouselItems.length, isCarouselPaused])

  const filteredRewards = useMemo(() => {
    return rewards.filter((item) => {
      const matchSearch =
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.descripcion.toLowerCase().includes(searchTerm.toLowerCase())

      const itemCat = String(item.categoria || '').toLowerCase()
      const selCat = String(selectedCategory || '').toLowerCase()

      const matchCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'destacados' && Boolean(item.destacado)) ||
        itemCat === selCat ||
        itemCat.includes(selCat) ||
        selCat.includes(itemCat)

      return matchSearch && matchCategory
    })
  }, [rewards, searchTerm, selectedCategory])

  const filteredPartnerships = useMemo(() => {
    return partnerships.filter((partner) => {
      const matchSearch =
        partner.aliadoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.descuentoTexto.toLowerCase().includes(searchTerm.toLowerCase())

      const partCat = String(partner.categoria || '').toLowerCase()
      const selCat = String(selectedCategory || '').toLowerCase()

      const matchCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'destacados' && Boolean(partner.destacado)) ||
        partCat.includes(selCat) ||
        selCat.includes(partCat)

      return matchSearch && matchCategory
    })
  }, [partnerships, searchTerm, selectedCategory])

  async function handleRedeemReward(item) {
    if (bambooBalance < item.costoBambus) {
      setStatus({
        loading: false,
        error: 'No tienes suficientes bambús. Tu saldo es ' + bambooBalance + ' y necesitas ' + item.costoBambus + '.',
        success: '',
      })
      return
    }

    setStatus({ loading: true, error: '', success: '' })
    try {
      await AttendanceService.redeemReward(token, {
        recompensaNombre: item.nombre,
        costoBambus: item.costoBambus,
      })

      const newBalance = bambooBalance - item.costoBambus
      setBambooBalance(newBalance)

      const redemptionCode = 'PANDA-' + Math.floor(1000 + Math.random() * 9000)
      const newClaim = {
        nombre: item.nombre,
        costo: item.costoBambus,
        codigo: redemptionCode,
        fecha: new Date().toLocaleDateString('es-ES'),
        imagenUrl: getRewardImage(item),
      }

      setClaimedReward(newClaim)
      if (detailModalItem) setDetailModalItem(null)

      setMyRedemptions((prev) => [
        {
          id: Date.now(),
          recompensaNombre: item.nombre,
          costoBambus: item.costoBambus,
          codigoCanje: redemptionCode,
          fechaCanje: new Date().toISOString(),
          estado: 'canjeado',
        },
        ...prev,
      ])

      setStatus({
        loading: false,
        error: '',
        success: '¡Has canjeado "' + item.nombre + '" con éxito! Muestra tu código en recepción.',
      })
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Error al canjear recompensa', success: '' })
    }
  }

  function handleCopyCode(code) {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2200)
  }

  function handleAddCategory(e) {
    e.preventDefault()
    const trimmed = newCatName.trim()
    if (!trimmed) return
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      alert('Esta categoría ya se encuentra en el catálogo.')
      return
    }
    const updated = [...categories, trimmed]
    setCategories(updated)
    try {
      localStorage.setItem('panda_custom_categories', JSON.stringify(updated))
    } catch (_) {}
    setNewCatName('')
    setStatus({ loading: false, error: '', success: 'Categoría "' + trimmed + '" añadida exitosamente.' })
  }

  function handleRemoveCategory(catName) {
    if (categories.length <= 1) {
      alert('Debe existir al menos una categoría en el sistema.')
      return
    }
    if (!window.confirm('¿Seguro que deseas eliminar la categoría "' + catName + '"?')) return
    const updated = categories.filter((c) => c !== catName)
    setCategories(updated)
    try {
      localStorage.setItem('panda_custom_categories', JSON.stringify(updated))
    } catch (_) {}
  }

  function handleAddImageUrl(url, imagesList, setImagesList) {
    const trimmed = String(url || '').trim()
    if (!trimmed) return
    if (imagesList.length >= 5) {
      alert('Se permite un máximo de 5 imágenes por recompensa.')
      return
    }
    setImagesList([...imagesList, trimmed])
  }

  function handleImageFileUpload(e, imagesList, setImagesList) {
    const file = e.target.files?.[0]
    if (!file) return
    if (imagesList.length >= 5) {
      alert('Se permite un máximo de 5 imágenes por recompensa.')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      if (reader.result) {
        setImagesList([...imagesList, reader.result])
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleRemoveImage(index, imagesList, setImagesList) {
    setImagesList(imagesList.filter((_, i) => i !== index))
  }

  async function handleCreateReward(e) {
    e.preventDefault()
    const errors = {}
    if (!newReward.nombre?.trim()) {
      errors.nombre = 'El nombre de la recompensa es obligatorio.'
    }
    const costo = Number(newReward.costoBambus)
    if (!newReward.costoBambus || isNaN(costo) || costo < 10) {
      errors.costoBambus = 'El costo debe ser de al menos 10 bambús.'
    }
    const stock = Number(newReward.stock)
    if (newReward.stock === '' || isNaN(stock) || stock < 0) {
      errors.stock = 'El stock debe ser un número igual o mayor a 0.'
    }
    if (Object.keys(errors).length > 0) {
      setCreateRewardErrors(errors)
      return
    }

    setCreateRewardErrors({})
    try {
      const finalImage =
        newReward.images.length > 1
          ? JSON.stringify(newReward.images)
          : newReward.images[0] || ''

      const payload = {
        nombre: newReward.nombre,
        descripcion: newReward.descripcion,
        costoBambus: Number(newReward.costoBambus),
        categoria: newReward.categoria || categories[0] || 'General',
        stock: Number(newReward.stock) || 50,
        destacado: Boolean(newReward.destacado),
        imagenUrl: finalImage,
      }

      await RewardService.createReward(token, payload)
      setShowAddRewardModal(false)
      setNewReward({
        nombre: '',
        descripcion: '',
        costoBambus: 100,
        categoria: categories[0] || DEFAULT_CATEGORIES[0],
        stock: 50,
        images: [],
        destacado: false,
      })
      setNewRewardUrlInput('')
      setCreateRewardErrors({})
      setStatus({ loading: false, error: '', success: '¡Recompensa creada con éxito en el catálogo!' })
      await loadAllData()
    } catch (err) {
      setCreateRewardErrors({ general: err.message || 'Error creando recompensa' })
    }
  }

  function handleOpenEditReward(item) {
    const parsedImages = parseRewardImages(item.imagenUrl)
    setEditingReward(item)
    setEditRewardErrors({})
    setEditRewardForm({
      id: item.id,
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      costoBambus: item.costoBambus || 100,
      categoria: item.categoria || categories[0] || 'General',
      stock: item.stock ?? 50,
      destacado: Boolean(item.destacado),
      images: parsedImages,
    })
    setEditRewardUrlInput('')
  }

  async function handleUpdateReward(e) {
    e.preventDefault()
    if (!editingReward) return

    const errors = {}
    if (!editRewardForm.nombre?.trim()) {
      errors.nombre = 'El nombre de la recompensa es obligatorio.'
    }
    const costo = Number(editRewardForm.costoBambus)
    if (!editRewardForm.costoBambus || isNaN(costo) || costo < 10) {
      errors.costoBambus = 'El costo debe ser de al menos 10 bambús.'
    }
    const stock = Number(editRewardForm.stock)
    if (editRewardForm.stock === '' || isNaN(stock) || stock < 0) {
      errors.stock = 'El stock debe ser un número igual o mayor a 0.'
    }
    if (Object.keys(errors).length > 0) {
      setEditRewardErrors(errors)
      return
    }

    setEditRewardErrors({})
    try {
      const finalImage =
        editRewardForm.images.length > 1
          ? JSON.stringify(editRewardForm.images)
          : editRewardForm.images[0] || ''

      const payload = {
        nombre: editRewardForm.nombre,
        descripcion: editRewardForm.descripcion,
        costoBambus: Number(editRewardForm.costoBambus),
        categoria: editRewardForm.categoria || categories[0],
        stock: Number(editRewardForm.stock),
        destacado: Boolean(editRewardForm.destacado),
        imagenUrl: finalImage,
      }

      await RewardService.updateReward(token, editingReward.id, payload)
      setEditingReward(null)
      setEditRewardErrors({})
      setStatus({ loading: false, error: '', success: '¡Recompensa actualizada correctamente!' })
      await loadAllData()
    } catch (err) {
      setEditRewardErrors({ general: err.message || 'Error actualizando recompensa' })
    }
  }

  async function handleDeleteReward(id) {
    if (!window.confirm('¿Seguro que deseas desactivar esta recompensa del catálogo?')) return
    try {
      await RewardService.deleteReward(token, id)
      setStatus({ loading: false, error: '', success: 'Recompensa eliminada del catálogo.' })
      await loadAllData()
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Error eliminando recompensa', success: '' })
    }
  }

  async function handleCreatePartner(e) {
    e.preventDefault()
    const errors = {}
    if (!newPartner.aliadoNombre?.trim()) {
      errors.aliadoNombre = 'El nombre del aliado comercial es obligatorio.'
    }
    if (!newPartner.descuentoTexto?.trim()) {
      errors.descuentoTexto = 'Indica el beneficio o descuento promocional.'
    }
    if (Object.keys(errors).length > 0) {
      setPartnerErrors(errors)
      return
    }

    setPartnerErrors({})
    try {
      await RewardService.createPartnership(token, newPartner)
      setShowAddPartnerModal(false)
      setNewPartner({
        aliadoNombre: '',
        categoria: 'Nutrición y Suplementos',
        descuentoTexto: '20% de Descuento',
        descripcion: '',
        codigoPromocional: 'PANDA20',
        imagenUrl: '',
        destacado: false,
      })
      setPartnerErrors({})
      setStatus({ loading: false, error: '', success: '¡Convenio comercial agregado con éxito!' })
      await loadAllData()
    } catch (err) {
      setPartnerErrors({ general: err.message || 'Error creando convenio' })
    }
  }

  async function handleDeletePartner(id) {
    if (!window.confirm('¿Deseas dar de baja este convenio?')) return
    try {
      await RewardService.deletePartnership(token, id)
      setStatus({ loading: false, error: '', success: 'Convenio comercial retirado.' })
      await loadAllData()
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Error eliminando convenio', success: '' })
    }
  }

  async function handleDeliver(id) {
    try {
      await RewardService.deliverRedemption(token, id)
      setStatus({ loading: false, error: '', success: 'Premio marcado como ENTREGADO al socio.' })
      await loadAllData()
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Error actualizando entrega', success: '' })
    }
  }

  return (
    <div className="dashboard-page" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '70px', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Encabezado */}
      <div className="view-header-row d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <ViewTitle
            title="Recompensas, Promociones y Convenios"
            subtitle="Canjea tus bambús ganados con tu Pandita y aprovecha beneficios exclusivos con marcas aliadas."
          />
        </div>

        {/* Saldo de Bambús & Acceso a Mi Pandita */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <button
            type="button"
            onClick={() => navigate('/app/mi-pandita')}
            style={{
              padding: isMobile ? '10px 14px' : '12px 18px',
              borderRadius: '14px',
              border: '1.5px solid #16241c',
              background: '#ffffff',
              color: '#111d15',
              fontWeight: 800,
              fontSize: isMobile ? '0.8rem' : '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.2s',
              flex: isMobile ? '1 1 140px' : 'none',
            }}
          >
            <span style={{ fontSize: '1.15rem' }}>🐼</span>
            <span>Ver Mi Pandita</span>
          </button>

          <div
            style={{
              background: 'linear-gradient(135deg, #111d15 0%, #16241c 100%)',
              border: '1px solid #233c2a',
              borderRadius: '16px',
              padding: isMobile ? '10px 16px' : '12px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 6px 18px rgba(17, 29, 21, 0.25)',
              flex: isMobile ? '1 1 180px' : 'none',
              boxSizing: 'border-box',
            }}
          >
            <i className="bi bi-fire" style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', color: '#c4f039' }}></i>
            <div>
              <div
                style={{
                  fontSize: isMobile ? '0.65rem' : '0.72rem',
                  fontWeight: 800,
                  color: '#84cc16',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Tus Bambús Disponibles
              </div>
              <div style={{ fontSize: isMobile ? '1.25rem' : '1.45rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                {bambooBalance} <span style={{ fontSize: '0.82rem', color: '#c4f039' }}>BAMBÚS</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {status.success && (
        <div
          className="alert d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-4"
          style={{ background: '#ecfccb', borderColor: '#d9f99d', color: '#15803d', fontWeight: 600 }}
        >
          <i className="bi bi-check-circle-fill"></i>
          <span>{status.success}</span>
        </div>
      )}
      {status.error && (
        <div
          className="alert d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-4"
          style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#b91c1c', fontWeight: 600 }}
        >
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>{status.error}</span>
        </div>
      )}

      {/* CARRUSEL INTERACTIVO CON FLECHAS DISCRETAS */}
      {carouselItems.length > 0 && (
        <div
          style={{
            position: 'relative',
            borderRadius: isMobile ? '16px' : '24px',
            overflow: 'hidden',
            marginBottom: isMobile ? '18px' : '30px',
            boxShadow: '0 12px 36px rgba(17, 29, 21, 0.16)',
            background: '#111d15',
            minHeight: isMobile ? '230px' : '280px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
        >
          {carouselItems.map((item, index) => {
            const isActive = index === currentSlide
            return (
              <div
                key={item.id}
                style={{
                  position: isActive ? 'relative' : 'absolute',
                  inset: 0,
                  opacity: isActive ? 1 : 0,
                  pointerEvents: isActive ? 'auto' : 'none',
                  transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: isMobile ? '230px' : '280px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: isMobile ? '80%' : '62%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: 'brightness(0.85) contrast(1.05)',
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(90deg, #0e1712 0%, rgba(14, 23, 18, 0.96) 55%, rgba(14, 23, 18, 0.75) 80%, rgba(14, 23, 18, 0.3) 100%)',
                  }}
                />

                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: isMobile ? '16px 14px' : '32px 38px',
                    maxWidth: '660px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isMobile ? '8px' : '12px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: item.badgeBg,
                        color: item.badgeColor,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: isMobile ? '0.66rem' : '0.72rem',
                        fontWeight: 900,
                        letterSpacing: '0.05em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      }}
                    >
                      <i className={'bi ' + item.badgeIcon}></i>
                      <span>{item.badge}</span>
                    </span>
                    <span
                      style={{
                        color: '#94a3b8',
                        fontSize: isMobile ? '0.7rem' : '0.76rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {item.subtitle}
                    </span>
                  </div>

                  <h2
                    style={{
                      fontSize: isMobile ? '1.25rem' : '1.9rem',
                      fontWeight: 900,
                      color: '#ffffff',
                      marginBottom: isMobile ? '6px' : '10px',
                      lineHeight: 1.2,
                      letterSpacing: '-0.02em',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.title}
                  </h2>

                  <p
                    style={{
                      fontSize: isMobile ? '0.78rem' : '0.9rem',
                      color: '#cbd5e1',
                      marginBottom: isMobile ? '12px' : '20px',
                      lineHeight: 1.4,
                      maxWidth: '520px',
                    }}
                  >
                    {item.desc}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap', width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalItem({ type: item.type, data: item.rawItem })
                        setActiveDetailImageIndex(0)
                      }}
                      style={{
                        padding: isMobile ? '8px 14px' : '11px 22px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#c4f039',
                        color: '#111d15',
                        fontWeight: 800,
                        fontSize: isMobile ? '0.78rem' : '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(196, 240, 57, 0.35)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <i className="bi bi-arrows-angle-expand"></i>
                      <span>Ver Oferta</span>
                    </button>

                    {item.type === 'reward' ? (
                      <button
                        type="button"
                        onClick={() => handleRedeemReward(item.rawItem)}
                        disabled={bambooBalance < item.rawItem.costoBambus}
                        style={{
                          padding: isMobile ? '8px 12px' : '11px 18px',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: isMobile ? '0.78rem' : '0.86rem',
                          cursor: bambooBalance >= item.rawItem.costoBambus ? 'pointer' : 'not-allowed',
                          backdropFilter: 'blur(6px)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <i className="bi bi-fire text-lime"></i>
                        <span>{bambooBalance >= item.rawItem.costoBambus ? 'Canjear' : 'Bambús insuficientes'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleCopyCode(item.rawItem.codigoPromocional)
                          setDetailModalItem({ type: 'partner', data: item.rawItem })
                        }}
                        style={{
                          padding: isMobile ? '8px 12px' : '11px 18px',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: isMobile ? '0.78rem' : '0.86rem',
                          cursor: 'pointer',
                          backdropFilter: 'blur(6px)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <i className="bi bi-ticket-perforated"></i>
                        <span>Cupón: {item.rawItem.codigoPromocional}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {carouselItems.length > 1 && (
            <>
              <button
                type="button"
                className="carousel-arrow-btn"
                onClick={() => setCurrentSlide((prev) => (prev - 1 + carouselItems.length) % carouselItems.length)}
                aria-label="Anterior"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 3,
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                  transition: 'all 0.2s',
                }}
              >
                <i className="bi bi-chevron-left"></i>
              </button>

              <button
                type="button"
                className="carousel-arrow-btn"
                onClick={() => setCurrentSlide((prev) => (prev + 1) % carouselItems.length)}
                aria-label="Siguiente"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 3,
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                  transition: 'all 0.2s',
                }}
              >
                <i className="bi bi-chevron-right"></i>
              </button>

              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '20px',
                  zIndex: 3,
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}
              >
                {carouselItems.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => setCurrentSlide(dotIdx)}
                    aria-label={'Slide ' + (dotIdx + 1)}
                    style={{
                      width: dotIdx === currentSlide ? '22px' : '7px',
                      height: '7px',
                      borderRadius: '9999px',
                      background: dotIdx === currentSlide ? '#c4f039' : 'rgba(255, 255, 255, 0.35)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Pestañas de Navegación y Botones para Admin */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <div className="rewards-tabs-container">
          <div className="rewards-tabs-bar">
            <button
              type="button"
              onClick={() => {
                setActiveTab('catalogo')
                setSelectedCategory('all')
              }}
              style={{
                padding: '9px 16px',
                borderRadius: '11px',
                border: 'none',
                background: activeTab === 'catalogo' ? '#111d15' : 'transparent',
                color: activeTab === 'catalogo' ? '#c4f039' : '#5f7165',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="bi bi-gift-fill"></i>
              <span>Catálogo de Premios ({rewards.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('convenios')
                setSelectedCategory('all')
              }}
              style={{
                padding: '9px 16px',
                borderRadius: '11px',
                border: 'none',
                background: activeTab === 'convenios' ? '#111d15' : 'transparent',
                color: activeTab === 'convenios' ? '#c4f039' : '#5f7165',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="bi bi-shop"></i>
              <span>Convenios Comerciales ({partnerships.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mis_canjes')}
              style={{
                padding: '9px 16px',
                borderRadius: '11px',
                border: 'none',
                background: activeTab === 'mis_canjes' ? '#111d15' : 'transparent',
                color: activeTab === 'mis_canjes' ? '#c4f039' : '#5f7165',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="bi bi-ticket-perforated-fill"></i>
              <span>Mis Canjes ({myRedemptions.length})</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin_canjes')}
                style={{
                  padding: '9px 16px',
                  borderRadius: '11px',
                  border: 'none',
                  background: activeTab === 'admin_canjes' ? '#111d15' : 'transparent',
                  color: activeTab === 'admin_canjes' ? '#c4f039' : '#5f7165',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="bi bi-box-seam-fill"></i>
                <span>Recepción / Entregas ({allRedemptions.length})</span>
              </button>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="rewards-admin-actions-bar">
            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className="btn btn-sm btn-outline-dark d-flex align-items-center gap-1 px-3 py-2"
              style={{ borderRadius: '10px', fontWeight: 700, fontSize: '0.84rem' }}
            >
              <i className="bi bi-tags-fill text-success"></i>
              <span>Categorías</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddRewardModal(true)}
              className="btn btn-sm d-flex align-items-center gap-1 px-3 py-2"
              style={{
                background: '#c4f039',
                color: '#111d15',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.84rem',
                boxShadow: '0 2px 8px rgba(196, 240, 57, 0.3)',
              }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Nueva Recompensa</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddPartnerModal(true)}
              className="btn btn-sm btn-outline-dark d-flex align-items-center gap-1 px-3 py-2"
              style={{ borderRadius: '10px', fontWeight: 700, fontSize: '0.84rem' }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Nuevo Convenio</span>
            </button>
          </div>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      {(activeTab === 'catalogo' || activeTab === 'convenios') && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: isMobile ? '12px 14px' : '14px 18px',
            border: '1px solid #e3e8e2',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'relative', width: '100%', minWidth: 0 }}>
            <i
              className="bi bi-search"
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '0.9rem',
              }}
            ></i>
            <input
              type="text"
              placeholder={
                activeTab === 'catalogo'
                  ? 'Buscar por nombre o descripción...'
                  : 'Buscar por aliado o beneficio...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{
                paddingLeft: '38px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '0.86rem',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div className="rewards-filters-scroll-bar">
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', marginRight: '2px', flexShrink: 0 }}>
              Filtrar:
            </span>

            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '9999px',
                border: 'none',
                background: selectedCategory === 'all' ? '#111d15' : '#f1f5f9',
                color: selectedCategory === 'all' ? '#c4f039' : '#475569',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <i className="bi bi-grid-fill me-1"></i>
              <span>Todos</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('destacados')}
              style={{
                padding: '5px 12px',
                borderRadius: '9999px',
                border: 'none',
                background: selectedCategory === 'destacados' ? '#c4f039' : '#f1f5f9',
                color: '#111d15',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <i className="bi bi-star-fill me-1 text-dark"></i>
              <span>Destacados</span>
            </button>

            {categories.map((cat, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  border: 'none',
                  background: selectedCategory === cat ? '#111d15' : '#f1f5f9',
                  color: selectedCategory === cat ? '#c4f039' : '#475569',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <i className="bi bi-tag-fill me-1"></i>
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CATÁLOGO DE RECOMPENSAS (2 COLUMNAS EN MÓVIL) */}
      {activeTab === 'catalogo' && (
        <>
          {filteredRewards.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: '#ffffff',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
              }}
            >
              <i className="bi bi-search" style={{ fontSize: '2.5rem', color: '#94a3b8', display: 'block', marginBottom: '12px' }}></i>
              <h4 style={{ fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                No se encontraron recompensas
              </h4>
            </div>
          ) : (
            <div
              className="rewards-catalog-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: isMobile ? '8px' : '20px',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              {filteredRewards.map((item) => {
                const canAfford = bambooBalance >= item.costoBambus
                const imageUrl = getRewardImage(item)
                const itemImages = parseRewardImages(item.imagenUrl)

                return (
                  <div
                    key={item.id}
                    className="reward-card-item"
                    style={{
                      background: '#ffffff',
                      borderRadius: isMobile ? '14px' : '18px',
                      border: '1px solid #e3e8e2',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 18px rgba(18, 31, 23, 0.05)',
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                      position: 'relative',
                      minWidth: 0,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className="reward-card-img-wrap"
                      style={{
                        position: 'relative',
                        height: isMobile ? '120px' : '180px',
                        minHeight: isMobile ? '120px' : '180px',
                        maxHeight: isMobile ? '120px' : '180px',
                        width: '100%',
                        overflow: 'hidden',
                        background: '#0f172a',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setDetailModalItem({ type: 'reward', data: item })
                        setActiveDetailImageIndex(0)
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={item.nombre}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.4s ease',
                        }}
                      />

                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.6) 100%)',
                          pointerEvents: 'none',
                        }}
                      />

                      <div
                        className="reward-badge-cost"
                        style={{
                          position: 'absolute',
                          top: isMobile ? '6px' : '10px',
                          left: isMobile ? '6px' : '10px',
                          background: '#111d15',
                          color: '#c4f039',
                          padding: isMobile ? '3px 6px' : '4px 10px',
                          borderRadius: isMobile ? '6px' : '8px',
                          fontSize: isMobile ? '0.66rem' : '0.76rem',
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}
                      >
                        <i className="bi bi-fire text-lime"></i>
                        <span>{item.costoBambus}</span>
                      </div>

                      <div className="reward-badge-tag" style={{ position: 'absolute', top: isMobile ? '6px' : '10px', right: isMobile ? '6px' : '10px', display: 'flex', gap: '4px' }}>
                        {item.destacado ? (
                          <span
                            style={{
                              background: '#c4f039',
                              color: '#111d15',
                              padding: isMobile ? '2px 5px' : '4px 8px',
                              borderRadius: isMobile ? '6px' : '7px',
                              fontSize: isMobile ? '0.62rem' : '0.7rem',
                              fontWeight: 900,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <i className="bi bi-stars"></i>
                            <span>TOP</span>
                          </span>
                        ) : null}
                      </div>

                      {itemImages.length > 1 && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '6px',
                            left: '6px',
                            background: 'rgba(17, 29, 21, 0.75)',
                            color: '#ffffff',
                            padding: '2px 6px',
                            borderRadius: '5px',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            backdropFilter: 'blur(4px)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <i className="bi bi-images"></i>
                          <span>{itemImages.length}</span>
                        </span>
                      )}

                      {!isMobile && (
                        <button
                          type="button"
                          className="reward-expand-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailModalItem({ type: 'reward', data: item })
                            setActiveDetailImageIndex(0)
                          }}
                          style={{
                            position: 'absolute',
                            bottom: '10px',
                            right: '10px',
                            background: 'rgba(17, 29, 21, 0.85)',
                            color: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: '8px',
                            padding: '4px 9px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <i className="bi bi-arrows-angle-expand"></i>
                          <span>Agrandar</span>
                        </button>
                      )}
                    </div>

                    <div
                      className="reward-card-body"
                      style={{
                        padding: isMobile ? '8px 6px' : '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        justifyContent: 'space-between',
                        minWidth: 0,
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ minWidth: 0, width: '100%' }}>
                        <div style={{ fontSize: isMobile ? '0.62rem' : '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.categoria}
                        </div>

                        <h3
                          className="reward-card-title"
                          style={{
                            fontSize: isMobile ? '0.82rem' : '1.05rem',
                            fontWeight: 900,
                            color: '#111d15',
                            margin: '0 0 4px 0',
                            lineHeight: 1.25,
                            cursor: 'pointer',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                          onClick={() => {
                            setDetailModalItem({ type: 'reward', data: item })
                            setActiveDetailImageIndex(0)
                          }}
                        >
                          {item.nombre}
                        </h3>

                        <p
                          className="reward-card-desc"
                          style={{
                            fontSize: isMobile ? '0.68rem' : '0.8rem',
                            color: '#5f7165',
                            margin: '0 0 8px 0',
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.descripcion}
                        </p>
                      </div>

                      <div style={{ minWidth: 0, width: '100%' }}>
                        <button
                          type="button"
                          className="reward-card-btn"
                          disabled={!canAfford}
                          onClick={() => handleRedeemReward(item)}
                          style={{
                            width: '100%',
                            padding: isMobile ? '6px 4px' : '10px',
                            borderRadius: isMobile ? '8px' : '10px',
                            border: 'none',
                            background: canAfford ? '#c4f039' : '#e2e8f0',
                            color: canAfford ? '#111d15' : '#94a3b8',
                            fontWeight: 800,
                            fontSize: isMobile ? '0.72rem' : '0.84rem',
                            cursor: canAfford ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            boxShadow: canAfford ? '0 3px 10px rgba(196, 240, 57, 0.25)' : 'none',
                            minWidth: 0,
                          }}
                        >
                          <i className="bi bi-check2-circle" style={{ fontSize: isMobile ? '0.8rem' : '1rem' }}></i>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {canAfford ? 'Canjear' : 'Faltan ' + (item.costoBambus - bambooBalance)}
                          </span>
                        </button>

                        {isAdmin && (
                          <div
                            className="reward-card-admin-row"
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '4px',
                              marginTop: '6px',
                              paddingTop: '6px',
                              borderTop: '1px dashed #e2e8f0',
                            }}
                          >
                            <span style={{ fontSize: isMobile ? '0.62rem' : '0.7rem', color: '#94a3b8' }}>
                              Stock: {item.stock ?? 50}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditReward(item)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#2563eb',
                                  fontSize: isMobile ? '0.68rem' : '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                <i className="bi bi-pencil-square"></i>
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteReward(item.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  fontSize: isMobile ? '0.68rem' : '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                <i className="bi bi-trash3-fill"></i>
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* CONVENIOS COMERCIALES */}
      {activeTab === 'convenios' && (
        <div>
          <div
            style={{
              background: '#f8fafc',
              padding: '16px 20px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              marginBottom: '24px',
            }}
          >
            <h4 style={{ margin: '0 0 4px 0', fontWeight: 800, color: '#111d15', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="bi bi-shop text-primary"></i>
              <span>Alianzas y Descuentos Exclusivos para Socios</span>
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#5f7165' }}>
              Presenta tu membresía de Panda Fitness en cualquiera de nuestros comercios aliados o utiliza el código promocional para acceder a precios preferenciales.
            </p>
          </div>

          {filteredPartnerships.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: '#ffffff',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
              }}
            >
              <i className="bi bi-search" style={{ fontSize: '2.5rem', color: '#94a3b8', display: 'block', marginBottom: '12px' }}></i>
              <h4 style={{ fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                No se encontraron convenios</h4></div>
          ) : (
            <div
              className="rewards-catalog-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: isMobile ? '8px' : '20px',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              {filteredPartnerships.map((partner) => {
                const imageUrl = getPartnerImage(partner)

                return (
                  <div
                    key={partner.id}
                    className="reward-card-item"
                    style={{
                      background: '#ffffff',
                      borderRadius: isMobile ? '14px' : '18px',
                      border: '1px solid #e3e8e2',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 18px rgba(18, 31, 23, 0.05)',
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                      position: 'relative',
                      minWidth: 0,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className="reward-card-img-wrap"
                      style={{
                        position: 'relative',
                        height: isMobile ? '120px' : '180px',
                        minHeight: isMobile ? '120px' : '180px',
                        maxHeight: isMobile ? '120px' : '180px',
                        width: '100%',
                        overflow: 'hidden',
                        background: '#0f172a',
                        cursor: 'pointer',
                      }}
                      onClick={() => setDetailModalItem({ type: 'partner', data: partner })}
                    >
                      <img
                        src={imageUrl}
                        alt={partner.aliadoNombre}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />

                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.65) 100%)',
                          pointerEvents: 'none',
                        }}
                      />

                      <div
                        className="reward-badge-cost"
                        style={{
                          position: 'absolute',
                          top: isMobile ? '6px' : '10px',
                          left: isMobile ? '6px' : '10px',
                          background: '#16a34a',
                          color: '#ffffff',
                          padding: isMobile ? '3px 6px' : '4px 10px',
                          borderRadius: isMobile ? '6px' : '8px',
                          fontSize: isMobile ? '0.66rem' : '0.76rem',
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <i className="bi bi-tag-fill"></i>
                        <span>{partner.descuentoTexto}</span>
                      </div>

                      <div className="reward-badge-tag" style={{ position: 'absolute', top: isMobile ? '6px' : '10px', right: isMobile ? '6px' : '10px', display: 'flex', gap: '4px' }}>
                        {partner.destacado ? (
                          <span
                            style={{
                              background: '#38bdf8',
                              color: '#082f49',
                              padding: isMobile ? '2px 5px' : '4px 8px',
                              borderRadius: isMobile ? '6px' : '7px',
                              fontSize: isMobile ? '0.62rem' : '0.7rem',
                              fontWeight: 900,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <i className="bi bi-star-fill"></i>
                            <span>TOP</span>
                          </span>
                        ) : null}
                      </div>

                      {!isMobile && (
                        <button
                          type="button"
                          className="reward-expand-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailModalItem({ type: 'partner', data: partner })
                          }}
                          style={{
                            position: 'absolute',
                            bottom: '10px',
                            right: '10px',
                            background: 'rgba(17, 29, 21, 0.85)',
                            color: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: '8px',
                            padding: '4px 9px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <i className="bi bi-arrows-angle-expand"></i>
                          <span>Ver Ficha</span>
                        </button>
                      )}
                    </div>

                    <div
                      className="reward-card-body"
                      style={{
                        padding: isMobile ? '8px 6px' : '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        justifyContent: 'space-between',
                        minWidth: 0,
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ minWidth: 0, width: '100%' }}>
                        <div style={{ fontSize: isMobile ? '0.62rem' : '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {partner.categoria}
                        </div>

                        <h3
                          className="reward-card-title"
                          style={{
                            fontSize: isMobile ? '0.82rem' : '1.05rem',
                            fontWeight: 900,
                            color: '#111d15',
                            margin: '0 0 4px 0',
                            cursor: 'pointer',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                          onClick={() => setDetailModalItem({ type: 'partner', data: partner })}
                        >
                          {partner.aliadoNombre}
                        </h3>

                        <p
                          className="reward-card-desc"
                          style={{
                            fontSize: isMobile ? '0.68rem' : '0.8rem',
                            color: '#5f7165',
                            margin: '0 0 8px 0',
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          {partner.descripcion}
                        </p>
                      </div>

                      <div style={{ minWidth: 0, width: '100%' }}>
                        <div
                          style={{
                            background: '#f8fafc',
                            padding: isMobile ? '6px 8px' : '10px 12px',
                            borderRadius: '8px',
                            border: '1px dashed #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '6px',
                            gap: '4px',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: isMobile ? '0.58rem' : '0.66rem', color: '#64748b', display: 'block' }}>CUPÓN:</span>
                            <strong style={{ fontSize: isMobile ? '0.75rem' : '0.9rem', color: '#111d15', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {partner.codigoPromocional}
                            </strong>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyCode(partner.codigoPromocional)}
                            style={{
                              padding: isMobile ? '4px 6px' : '5px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#111d15',
                              color: '#c4f039',
                              fontSize: isMobile ? '0.66rem' : '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              flexShrink: 0,
                            }}
                          >
                            <i className="bi bi-copy"></i>
                            <span>Copiar</span>
                          </button>
                        </div>

                        {isAdmin && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleDeletePartner(partner.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: isMobile ? '0.68rem' : '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <i className="bi bi-trash3-fill"></i>
                              <span>Eliminar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL MIS CANJES */}
      {activeTab === 'mis_canjes' && (
        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e3e8e2' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111d15', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="bi bi-clock-history text-success"></i>
            <span>Historial de Recompensas Canjeadas</span>
          </h3>

          {myRedemptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              Aún no has canjeado recompensas. ¡Entrena en Panda Fitness para sumar bambús!
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle m-0">
                <thead>
                  <tr>
                    <th>Recompensa</th>
                    <th>Costo</th>
                    <th>Código de Reclamación</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {myRedemptions.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 fw-bold text-dark">{r.recompensaNombre}</td>
                      <td className="px-3 text-success fw-bold">
                        <i className="bi bi-fire me-1"></i>
                        {r.costoBambus}
                      </td>
                      <td className="px-3 font-monospace fw-bold">{r.codigoCanje || 'PANDA-CANJE'}</td>
                      <td className="px-3 text-muted">{r.fechaCanje?.slice(0, 10)}</td>
                      <td className="px-3">
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            background: r.estado === 'entregado' ? '#ecfccb' : '#fef3c7',
                            color: r.estado === 'entregado' ? '#15803d' : '#b45309',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className={'bi ' + (r.estado === 'entregado' ? 'bi-check2' : 'bi-hourglass-split')}></i>
                          <span>{r.estado === 'entregado' ? 'Entregado' : 'Listo para Reclamar'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RECEPCIÓN / ENTREGAS (ADMIN) */}
      {isAdmin && activeTab === 'admin_canjes' && (
        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px 18px', border: '1px solid #e3e8e2' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111d15', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="bi bi-box-seam-fill text-primary"></i>
            <span>Validación y Entrega de Premios en Mostrador</span>
          </h3>

          <div className="table-responsive">
            <table className="table table-hover align-middle m-0">
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>DNI</th>
                  <th>Premio</th>
                  <th>Código</th>
                  <th>Estado</th>
                  <th className="text-end">Acción</th>
                </tr>
              </thead>
              <tbody>
                {allRedemptions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      No hay registros de canjes pendientes.
                    </td>
                  </tr>
                ) : (
                  allRedemptions.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 fw-bold text-dark">
                        {r.nombre} {r.apellido}
                      </td>
                      <td className="px-3 text-muted">{r.dni}</td>
                      <td className="px-3 fw-semibold">{r.recompensaNombre}</td>
                      <td className="px-3 font-monospace fw-bold">{r.codigoCanje || 'PANDA-CANJE'}</td>
                      <td className="px-3">
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            background: r.estado === 'entregado' ? '#ecfccb' : '#fef3c7',
                            color: r.estado === 'entregado' ? '#15803d' : '#b45309',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className={'bi ' + (r.estado === 'entregado' ? 'bi-check2' : 'bi-hourglass-split')}></i>
                          <span>{r.estado}</span>
                        </span>
                      </td>
                      <td className="px-3 text-end">
                        {r.estado !== 'entregado' && (
                          <button
                            type="button"
                            onClick={() => handleDeliver(r.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#c4f039',
                              color: '#111d15',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: 800,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-check-circle-fill"></i>
                            <span>Marcar Entregado</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL FICHA COMPLETA */}
      <ModalDialog
        isOpen={!!detailModalItem}
        onClose={() => setDetailModalItem(null)}
        title={detailModalItem?.type === 'reward' ? 'Detalle de la Recompensa' : 'Beneficio Comercial Aliado'}
        subtitle="Conoce todas las condiciones, galería y detalles completos"
        badge={detailModalItem?.type === 'reward' ? 'CATÁLOGO PANDA' : 'CONVENIO EXCLUSIVO'}
        size="lg"
      >
        {detailModalItem && (() => {
          const isReward = detailModalItem.type === 'reward'
          const item = detailModalItem.data
          const gallery = isReward ? getRewardImages(item) : [getPartnerImage(item)]
          const currentImg = gallery[activeDetailImageIndex] || gallery[0]

          return (
            <div>
              <div
                style={{
                  position: 'relative',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  height: '260px',
                  marginBottom: '14px',
                  background: '#0f172a',
                }}
              >
                <img
                  src={currentImg}
                  alt="Vista detallada"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.65) 100%)',
                    pointerEvents: 'none',
                  }}
                />

                <div style={{ position: 'absolute', top: '14px', left: '14px', display: 'flex', gap: '8px' }}>
                  {isReward ? (
                    <span
                      style={{
                        background: '#111d15',
                        color: '#c4f039',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className="bi bi-fire text-lime"></i>
                      <span>{item.costoBambus} BAMBÚS</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className="bi bi-tag-fill"></i>
                      <span>{item.descuentoTexto}</span>
                    </span>
                  )}

                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      color: '#1e293b',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.categoria}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setZoomImage(currentImg)}
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    right: '14px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <i className="bi bi-zoom-in"></i>
                  <span>Ver Pantalla Completa</span>
                </button>
              </div>

              {gallery.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {gallery.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveDetailImageIndex(idx)}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: idx === activeDetailImageIndex ? '2px solid #84cc16' : '1px solid #cbd5e1',
                        padding: 0,
                        cursor: 'pointer',
                        background: '#000',
                        flexShrink: 0,
                      }}
                    >
                      <img src={img} alt={'Foto ' + (idx + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#111d15', margin: '0 0 6px 0' }}>
                  {isReward ? item.nombre : item.aliadoNombre}
                </h2>
                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                  {item.descripcion}
                </p>
              </div>

              {isReward ? (
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '14px',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '18px',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>TU SALDO ACTUAL:</span>
                      <strong style={{ fontSize: '1.05rem', color: '#111d15' }}>{bambooBalance} Bambús</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>COSTO DEL CANJE:</span>
                      <strong style={{ fontSize: '1.05rem', color: '#15803d' }}>{item.costoBambus} Bambús</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-info-circle-fill text-primary"></i>
                    <span>Presenta tu código de canje generado en recepción para retirar tu producto.</span>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '14px',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '18px',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    CÓDIGO DE CUPÓN EXCLUSIVO:
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ffffff',
                      border: '2px dashed #84cc16',
                      padding: '10px 14px',
                      borderRadius: '10px',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'monospace', color: '#111d15' }}>
                      {item.codigoPromocional}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(item.codigoPromocional)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '7px',
                        border: 'none',
                        background: copiedCode ? '#15803d' : '#111d15',
                        color: copiedCode ? '#ffffff' : '#c4f039',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className={'bi ' + (copiedCode ? 'bi-check2' : 'bi-copy')}></i>
                      <span>{copiedCode ? 'Copiado' : 'Copiar Código'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setDetailModalItem(null)}
                  className="btn btn-outline-secondary px-3 py-2"
                  style={{ borderRadius: '10px', fontWeight: 700, fontSize: '0.86rem' }}
                >
                  Cerrar
                </button>

                {isReward && (
                  <button
                    type="button"
                    disabled={bambooBalance < item.costoBambus}
                    onClick={() => handleRedeemReward(item)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: bambooBalance >= item.costoBambus ? '#c4f039' : '#e2e8f0',
                      color: bambooBalance >= item.costoBambus ? '#111d15' : '#94a3b8',
                      fontWeight: 900,
                      fontSize: '0.86rem',
                      cursor: bambooBalance >= item.costoBambus ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="bi bi-check2-circle"></i>
                    <span>Canjear Recompensa</span>
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </ModalDialog>

      {/* MODAL ZOOM */}
      <ModalDialog
        isOpen={!!zoomImage}
        onClose={() => setZoomImage(null)}
        title="Visualización en Alta Definición"
        subtitle="Imagen oficial del catálogo Panda Fitness"
        size="lg"
      >
        {zoomImage && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={zoomImage}
              alt="Zoom"
              style={{
                width: '100%',
                maxHeight: '500px',
                objectFit: 'contain',
                borderRadius: '12px',
                background: '#0f172a',
              }}
            />
            <div style={{ marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="btn btn-dark px-4 py-2"
                style={{ borderRadius: '10px', fontWeight: 700 }}
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* MODAL CANJE CONFIRMADO */}
      <ModalDialog
        isOpen={!!claimedReward}
        onClose={() => setClaimedReward(null)}
        title="¡Canje Confirmado!"
        subtitle="Muestra este comprobante en la recepción de Panda Fitness"
        badge="RECLAMAR PREMIO"
        size="sm"
      >
        {claimedReward && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            {claimedReward.imagenUrl && (
              <img
                src={claimedReward.imagenUrl}
                alt={claimedReward.nombre}
                style={{
                  width: '100%',
                  height: '130px',
                  objectFit: 'cover',
                  borderRadius: '12px',
                  marginBottom: '14px',
                }}
              />
            )}

            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#111d15', marginBottom: '4px' }}>
              {claimedReward.nombre}
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#5f7165', margin: '0 0 16px 0' }}>
              Se han descontado <strong>{claimedReward.costo} bambús</strong> de tu cuenta.
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '2px dashed #84cc16',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '18px',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 700 }}>
                CÓDIGO DE RECLAMACIÓN:
              </span>
              <strong style={{ fontSize: '1.45rem', color: '#166534', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                {claimedReward.codigo}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => setClaimedReward(null)}
              style={{
                width: '100%',
                padding: '11px',
                background: '#111d15',
                color: '#c4f039',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              Entendido
            </button>
          </div>
        )}
      </ModalDialog>

      {/* MODAL GESTIÓN DE CATEGORÍAS */}
      <ModalDialog
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Gestionar Categorías del Catálogo"
        subtitle="Crea o elimina las categorías para organizar productos y filtros"
        badge="Administración"
        size="md"
      >
        <div>
          <form onSubmit={handleAddCategory} className="mb-4">
            <label className="form-label fw-bold text-dark small mb-1">Nueva Categoría</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                placeholder="Ej: Snacks Saludables, Merchandising..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                style={{ borderRadius: '10px 0 0 10px' }}
              />
              <button
                type="submit"
                className="btn btn-dark fw-bold px-3 d-flex align-items-center gap-1"
                style={{ background: '#111d15', color: '#c4f039', borderRadius: '0 10px 10px 0', border: 'none' }}
              >
                <i className="bi bi-plus-lg"></i>
                <span>Agregar</span>
              </button>
            </div>
          </form>

          <div>
            <label className="form-label fw-bold text-dark small mb-2">Categorías Activas ({categories.length})</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-tag-fill text-success"></i>
                    <span>{cat}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="btn btn-sm btn-link text-danger p-0"
                    title="Eliminar categoría"
                  >
                    <i className="bi bi-trash3"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="d-flex justify-content-end mt-4">
            <button
              type="button"
              onClick={() => setShowCategoryModal(false)}
              className="btn btn-dark px-4 py-2"
              style={{ borderRadius: '10px', fontWeight: 800 }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* MODAL CREAR RECOMPENSA */}
      <ModalDialog
        isOpen={showAddRewardModal}
        onClose={() => setShowAddRewardModal(false)}
        title="Crear Nueva Recompensa"
        subtitle="Agrega un producto o servicio al catálogo de canjes"
        badge="Administración"
        size="lg"
      >
        <form onSubmit={handleCreateReward}>
          {createRewardErrors.general && (
            <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{createRewardErrors.general}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div className="row g-3">
              <div className="col-md-7">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Nombre del Premio *
                </label>
                <input
                  type="text"
                  value={newReward.nombre}
                  onChange={(e) => {
                    setNewReward({ ...newReward, nombre: e.target.value })
                    if (createRewardErrors.nombre) setCreateRewardErrors((prev) => ({ ...prev, nombre: '' }))
                  }}
                  placeholder="Ej: Shake de Proteína 30g..."
                  className={`form-control ${createRewardErrors.nombre ? 'is-invalid' : ''}`}
                  style={{ borderRadius: '10px', ...(createRewardErrors.nombre ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
                />
                {createRewardErrors.nombre && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{createRewardErrors.nombre}</span>
                  </div>
                )}
              </div>

              <div className="col-md-5">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Costo en Bambús *
                </label>
                <input
                  type="number"
                  min="10"
                  value={newReward.costoBambus}
                  onChange={(e) => {
                    setNewReward({ ...newReward, costoBambus: e.target.value })
                    if (createRewardErrors.costoBambus) setCreateRewardErrors((prev) => ({ ...prev, costoBambus: '' }))
                  }}
                  className={`form-control ${createRewardErrors.costoBambus ? 'is-invalid' : ''}`}
                  style={{ borderRadius: '10px', ...(createRewardErrors.costoBambus ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
                />
                {createRewardErrors.costoBambus && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{createRewardErrors.costoBambus}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Categoría
                </label>
                <select
                  value={newReward.categoria}
                  onChange={(e) => setNewReward({ ...newReward, categoria: e.target.value })}
                  className="form-select"
                  style={{ borderRadius: '10px' }}
                >
                  {categories.map((c, i) => (
                    <option key={i} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Stock Disponible *
                </label>
                <input
                  type="number"
                  min="0"
                  value={newReward.stock}
                  onChange={(e) => {
                    setNewReward({ ...newReward, stock: e.target.value })
                    if (createRewardErrors.stock) setCreateRewardErrors((prev) => ({ ...prev, stock: '' }))
                  }}
                  className={`form-control ${createRewardErrors.stock ? 'is-invalid' : ''}`}
                  style={{ borderRadius: '10px', ...(createRewardErrors.stock ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
                />
                {createRewardErrors.stock && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{createRewardErrors.stock}</span>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN DE IMÁGENES HASTA 5 */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bi bi-images text-success"></i>
                  <span>Imágenes del Producto (Opcional - Hasta 5)</span>
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>
                  {newReward.images.length}/5 añadidas
                </span>
              </div>

              {newReward.images.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {newReward.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: '74px',
                        height: '74px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: idx === 0 ? '2px solid #84cc16' : '1px solid #cbd5e1',
                        background: '#000',
                      }}
                    >
                      <img src={imgUrl} alt={'Foto ' + (idx + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {idx === 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(17, 29, 21, 0.85)',
                            color: '#c4f039',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            textAlign: 'center',
                            padding: '1px 0',
                          }}
                        >
                          Principal
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx, newReward.images, (imgs) => setNewReward({ ...newReward, images: imgs }))}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'rgba(239, 68, 68, 0.9)',
                          color: '#ffffff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '10px',
                        }}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {newReward.images.length < 5 && (
                <div>
                  <div className="row g-2 align-items-center mb-2">
                    <div className="col-sm-8">
                      <div className="input-group">
                        <input
                          type="url"
                          placeholder="Pegar URL de imagen (https://...)"
                          value={newRewardUrlInput}
                          onChange={(e) => setNewRewardUrlInput(e.target.value)}
                          className="form-control form-control-sm"
                          style={{ borderRadius: '8px 0 0 8px', fontSize: '0.82rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleAddImageUrl(newRewardUrlInput, newReward.images, (imgs) => setNewReward({ ...newReward, images: imgs }))
                            setNewRewardUrlInput('')
                          }}
                          className="btn btn-sm btn-dark"
                          style={{ borderRadius: '0 8px 8px 0', fontSize: '0.78rem' }}
                        >
                          <i className="bi bi-plus-lg me-1"></i>
                          <span>Agregar URL</span>
                        </button>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <input
                        ref={fileInputRefCreate}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleImageFileUpload(e, newReward.images, (imgs) => setNewReward({ ...newReward, images: imgs }))}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefCreate.current?.click()}
                        className="btn btn-sm btn-outline-dark w-100 d-flex align-items-center justify-content-center gap-1"
                        style={{ borderRadius: '8px', fontSize: '0.8rem' }}
                      >
                        <i className="bi bi-upload"></i>
                        <span>Subir Archivo</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {REWARD_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (newReward.images.length < 5) {
                            setNewReward((prev) => ({
                              ...prev,
                              images: [...prev.images, preset.imagenUrl],
                              nombre: prev.nombre || preset.label,
                            }))
                          }
                        }}
                        style={{
                          flex: '0 0 auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <img src={preset.imagenUrl} alt={preset.label} style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'cover' }} />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="createRewardDestacado"
                checked={newReward.destacado}
                onChange={(e) => setNewReward({ ...newReward, destacado: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="createRewardDestacado" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="bi bi-star-fill text-warning"></i>
                <span>Destacar esta recompensa en el Carrusel Superior</span>
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                Descripción & Requisitos
              </label>
              <textarea
                value={newReward.descripcion}
                onChange={(e) => setNewReward({ ...newReward, descripcion: e.target.value })}
                placeholder="Detalla qué incluye el premio y cómo retirarlo..."
                className="form-control"
                rows="2"
                style={{ borderRadius: '10px', fontSize: '0.86rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowAddRewardModal(false)}
              className="btn btn-outline-dark px-3 py-2"
              style={{ borderRadius: '10px', fontSize: '0.86rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-dark px-4 py-2"
              style={{ background: '#c4f039', color: '#111d15', border: 'none', fontWeight: 800, borderRadius: '10px', fontSize: '0.86rem' }}
            >
              Publicar Recompensa
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* MODAL EDITAR RECOMPENSA */}
      <ModalDialog
        isOpen={!!editingReward}
        onClose={() => setEditingReward(null)}
        title="Editar Recompensa"
        subtitle="Modifica los datos, precio, stock o galería de imágenes del premio"
        badge="Administración"
        size="lg"
      >
        <form onSubmit={handleUpdateReward}>
          {editRewardErrors.general && (
            <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{editRewardErrors.general}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div className="row g-3">
              <div className="col-md-7">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Nombre del Premio *
                </label>
                <input
                  type="text"
                  value={editRewardForm.nombre}
                  onChange={(e) => {
                    setEditRewardForm({ ...editRewardForm, nombre: e.target.value })
                    if (editRewardErrors.nombre) setEditRewardErrors((prev) => ({ ...prev, nombre: '' }))
                  }}
                  className={`form-control ${editRewardErrors.nombre ? 'is-invalid' : ''}`}
                  style={{ borderRadius: '10px', ...(editRewardErrors.nombre ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
                />
                {editRewardErrors.nombre && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{editRewardErrors.nombre}</span>
                  </div>
                )}
              </div>

              <div className="col-md-5">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Costo en Bambús *
                </label>
                <input
                  type="number"
                  min="10"
                  value={editRewardForm.costoBambus}
                  onChange={(e) => {
                    setEditRewardForm({ ...editRewardForm, costoBambus: e.target.value })
                    if (editRewardErrors.costoBambus) setEditRewardErrors((prev) => ({ ...prev, costoBambus: '' }))
                  }}
                  className={`form-control ${editRewardErrors.costoBambus ? 'is-invalid' : ''}`}
                  style={{ borderRadius: '10px', ...(editRewardErrors.costoBambus ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
                />
                {editRewardErrors.costoBambus && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{editRewardErrors.costoBambus}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Categoría
                </label>
                <select
                  value={editRewardForm.categoria}
                  onChange={(e) => setEditRewardForm({ ...editRewardForm, categoria: e.target.value })}
                  className="form-select"
                  style={{ borderRadius: '10px' }}
                >
                  {categories.map((c, i) => (
                    <option key={i} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Stock Disponible *
                </label>
                <input
                  type="number"
                  min="0"
                  value={editRewardForm.stock}
                  onChange={(e) => {
                    setEditRewardForm({ ...editRewardForm, stock: e.target.value })
                    if (editRewardErrors.stock) setEditRewardErrors((prev) => ({ ...prev, stock: '' }))
                  }}
                  className={`form-control ${editRewardErrors.stock ? 'is-invalid' : ''}`}
                  style={{ borderRadius: '10px', ...(editRewardErrors.stock ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
                />
                {editRewardErrors.stock && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{editRewardErrors.stock}</span>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN DE IMÁGENES EN EDICIÓN */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bi bi-images text-success"></i>
                  <span>Galería de Imágenes ({editRewardForm.images.length}/5)</span>
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Opcional</span>
              </div>

              {editRewardForm.images.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {editRewardForm.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: '74px',
                        height: '74px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: idx === 0 ? '2px solid #84cc16' : '1px solid #cbd5e1',
                        background: '#000',
                      }}
                    >
                      <img src={imgUrl} alt={'Foto ' + (idx + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {idx === 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(17, 29, 21, 0.85)',
                            color: '#c4f039',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            textAlign: 'center',
                            padding: '1px 0',
                          }}
                        >
                          Principal
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx, editRewardForm.images, (imgs) => setEditRewardForm({ ...editRewardForm, images: imgs }))}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'rgba(239, 68, 68, 0.9)',
                          color: '#ffffff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '10px',
                        }}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {editRewardForm.images.length < 5 && (
                <div>
                  <div className="row g-2 align-items-center mb-2">
                    <div className="col-sm-8">
                      <div className="input-group">
                        <input
                          type="url"
                          placeholder="Pegar URL de imagen (https://...)"
                          value={editRewardUrlInput}
                          onChange={(e) => setEditRewardUrlInput(e.target.value)}
                          className="form-control form-control-sm"
                          style={{ borderRadius: '8px 0 0 8px', fontSize: '0.82rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleAddImageUrl(editRewardUrlInput, editRewardForm.images, (imgs) => setEditRewardForm({ ...editRewardForm, images: imgs }))
                            setEditRewardUrlInput('')
                          }}
                          className="btn btn-sm btn-dark"
                          style={{ borderRadius: '0 8px 8px 0', fontSize: '0.78rem' }}
                        >
                          <i className="bi bi-plus-lg me-1"></i>
                          <span>Agregar URL</span>
                        </button>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <input
                        ref={fileInputRefEdit}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleImageFileUpload(e, editRewardForm.images, (imgs) => setEditRewardForm({ ...editRewardForm, images: imgs }))}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefEdit.current?.click()}
                        className="btn btn-sm btn-outline-dark w-100 d-flex align-items-center justify-content-center gap-1"
                        style={{ borderRadius: '8px', fontSize: '0.8rem' }}
                      >
                        <i className="bi bi-upload"></i>
                        <span>Subir Archivo</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="editRewardDestacado"
                checked={editRewardForm.destacado}
                onChange={(e) => setEditRewardForm({ ...editRewardForm, destacado: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="editRewardDestacado" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="bi bi-star-fill text-warning"></i>
                <span>Destacar esta recompensa en el Carrusel Superior</span>
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                Descripción & Requisitos
              </label>
              <textarea
                value={editRewardForm.descripcion}
                onChange={(e) => setEditRewardForm({ ...editRewardForm, descripcion: e.target.value })}
                className="form-control"
                rows="2"
                style={{ borderRadius: '10px', fontSize: '0.86rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setEditingReward(null)}
              className="btn btn-outline-dark px-3 py-2"
              style={{ borderRadius: '10px', fontSize: '0.86rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-dark px-4 py-2"
              style={{ background: '#c4f039', color: '#111d15', border: 'none', fontWeight: 800, borderRadius: '10px', fontSize: '0.86rem' }}
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* MODAL CREAR CONVENIO */}
      <ModalDialog
        isOpen={showAddPartnerModal}
        onClose={() => setShowAddPartnerModal(false)}
        title="Nuevo Convenio Comercial"
        subtitle="Registra una alianza o comercio asociado para los socios"
        badge="Alianzas"
        size="lg"
      >
        <form onSubmit={handleCreatePartner}>
          {partnerErrors.general && (
            <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{partnerErrors.general}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div className="row g-3">
              <div className="col-md-7">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Nombre del Aliado Comercial *
                </label>
                <input
                  type="text"
                  value={newPartner.aliadoNombre}
                  onChange={(e) => {
                    setNewPartner({ ...newPartner, aliadoNombre: e.target.value })
                    if (partnerErrors.aliadoNombre) setPartnerErrors((prev) => ({ ...prev, aliadoNombre: '' }))
                  }}
                  placeholder="Ej: Tienda de Suplementos Gold..."
                  className={`form-control ${partnerErrors.aliadoNombre ? 'is-invalid' : ''}`}
                  style={{ borderRadius: '10px', ...(partnerErrors.aliadoNombre ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
                />
                {partnerErrors.aliadoNombre && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{partnerErrors.aliadoNombre}</span>
                  </div>
                )}
              </div>

              <div className="col-md-5">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Categoría
                </label>
                <input
                  type="text"
                  value={newPartner.categoria}
                  onChange={(e) => setNewPartner({ ...newPartner, categoria: e.target.value })}
                  placeholder="Ej: Nutrición y Suplementos"
                  className="form-control"
                  style={{ borderRadius: '10px' }}
                />
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Beneficio o Descuento *
                </label>
                <input
                  type="text"
                  value={newPartner.descuentoTexto}
                  onChange={(e) => {
                    setNewPartner({ ...newPartner, descuentoTexto: e.target.value })
                    if (partnerErrors.descuentoTexto) setPartnerErrors((prev) => ({ ...prev, descuentoTexto: '' }))
                  }}
                  placeholder="Ej: 20% de Descuento en Proteínas..."
                  className={`form-control ${partnerErrors.descuentoTexto ? 'is-invalid' : ''}`}
                  style={{ borderRadius: '10px', ...(partnerErrors.descuentoTexto ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
                />
                {partnerErrors.descuentoTexto && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{partnerErrors.descuentoTexto}</span>
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Código Promocional
                </label>
                <input
                  type="text"
                  value={newPartner.codigoPromocional}
                  onChange={(e) => setNewPartner({ ...newPartner, codigoPromocional: e.target.value })}
                  placeholder="Ej: PANDAFIT20..."
                  className="form-control"
                  style={{ borderRadius: '10px' }}
                />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                <i className="bi bi-image text-success me-1"></i>
                <span>Imagen o Logo del Aliado (URL directa)</span>
              </label>
              <input
                type="url"
                value={newPartner.imagenUrl}
                onChange={(e) => setNewPartner({ ...newPartner, imagenUrl: e.target.value })}
                placeholder="https://..."
                className="form-control"
                style={{ borderRadius: '10px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="partnerDestacado"
                checked={newPartner.destacado}
                onChange={(e) => setNewPartner({ ...newPartner, destacado: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="partnerDestacado" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="bi bi-star-fill text-warning"></i>
                <span>Destacar este convenio en el Carrusel Superior</span>
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                Descripción / Condiciones de la Alianza
              </label>
              <textarea
                value={newPartner.descripcion}
                onChange={(e) => setNewPartner({ ...newPartner, descripcion: e.target.value })}
                placeholder="Indica cómo los socios pueden hacer válido el descuento..."
                className="form-control"
                rows="2"
                style={{ borderRadius: '10px', fontSize: '0.86rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowAddPartnerModal(false)}
              className="btn btn-outline-dark px-3 py-2"
              style={{ borderRadius: '10px', fontSize: '0.86rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-dark px-4 py-2"
              style={{ background: '#c4f039', color: '#111d15', border: 'none', fontWeight: 800, borderRadius: '10px', fontSize: '0.86rem' }}
            >
              Publicar Convenio
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  )
}
