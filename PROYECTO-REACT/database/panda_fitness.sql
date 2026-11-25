CREATE DATABASE IF NOT EXISTS panda_fitness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE panda_fitness;

-- 1. Roles base del sistema
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT IGNORE INTO roles (nombre) VALUES ('admin'), ('cliente'), ('recepcion'), ('entrenador'), ('supervisor');

-- 2. Permisos por rol (ventanas y etiquetas personalizadas)
CREATE TABLE IF NOT EXISTS role_access (
    rol_id INT PRIMARY KEY,
    etiqueta VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255) NOT NULL DEFAULT '',
    permisos JSON NOT NULL,
    actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Usuarios (administradores, personal y socios)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(20) NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    google_id VARCHAR(100) NULL,
    password_hash VARCHAR(255) NULL,
    telefono VARCHAR(9) DEFAULT NULL,
    rol_id INT NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo TINYINT(1) DEFAULT 1,
    reset_code VARCHAR(10) NULL,
    reset_expires DATETIME NULL,
    dias_objetivo VARCHAR(50) DEFAULT '1,2,4,5',
    horario_preferido VARCHAR(50) DEFAULT '07:00 - 08:30',
    bambus_canjeados INT DEFAULT 0,
    huella_registrada TINYINT(1) DEFAULT 1,
    fecha_nacimiento VARCHAR(30) NULL,
    direccion VARCHAR(255) NULL,
    contacto_emergencia VARCHAR(120) NULL,
    telefono_emergencia VARCHAR(20) NULL,
    avatar_url LONGTEXT NULL,
    preferencias TEXT NULL,
    FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- 4. Planes de membresía
CREATE TABLE IF NOT EXISTS planes_membresia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    duracion_dias INT NOT NULL,
    limite_semanal INT DEFAULT NULL,
    total_reservas INT DEFAULT NULL,
    precio DECIMAL(10,2) NOT NULL,
    descripcion TEXT
) ENGINE=InnoDB;

INSERT IGNORE INTO planes_membresia (nombre, duracion_dias, limite_semanal, total_reservas, precio, descripcion)
VALUES ('Mensual', 30, NULL, NULL, 80.00, 'Plan mensual'),
       ('Bimestral', 60, NULL, NULL, 150.00, 'Promoción de 2 meses'),
       ('Trimestral', 90, NULL, NULL, 200.00, 'Promoción de 3 meses'),
       ('Interdiario', 15, 3, 15, 50.00, 'Plan especial con 3 reservas por semana. max 15 días'),
       ('Anual', 365, NULL, NULL, 800.00, 'Super promoción de un año');

-- 5. Membresías de los clientes
CREATE TABLE IF NOT EXISTS membresias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    plan_id INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado ENUM('activo', 'expirado', 'cancelado') DEFAULT 'activo',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES planes_membresia(id),
    INDEX idx_usuario_estado (usuario_id, estado),
    INDEX idx_fecha_fin (fecha_fin)
) ENGINE=InnoDB;

-- 6. Pagos
CREATE TABLE IF NOT EXISTS pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha_pago DATE NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    membresia_id INT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (membresia_id) REFERENCES membresias(id) ON DELETE SET NULL,
    INDEX idx_fecha_pago (fecha_pago)
) ENGINE=InnoDB;

-- 7. Reservas
CREATE TABLE IF NOT EXISTS reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    hora_entrada DATETIME NOT NULL,
    hora_salida DATETIME NOT NULL,
    estado ENUM('pendiente', 'confirmada', 'cancelada', 'no_show', 'finalizada') DEFAULT 'pendiente',
    tipo ENUM('normal', 'checkin_directo') NOT NULL DEFAULT 'normal',
    reserva_origen_id INT NULL,
    duracion_minutos INT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_horario (hora_entrada, hora_salida),
    INDEX idx_usuario_fecha (usuario_id, hora_entrada)
) ENGINE=InnoDB;

-- 8. Asistencias (con observación de cierre automático tras 4h)
CREATE TABLE IF NOT EXISTS asistencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reserva_id INT NULL DEFAULT NULL,
    usuario_id INT NOT NULL,
    hora_entrada DATETIME NOT NULL,
    hora_salida DATETIME NULL,
    metodo_registro VARCHAR(30) NULL DEFAULT 'manual',
    observacion_salida VARCHAR(80) NULL DEFAULT NULL,
    FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Clientes diarios / invitados
CREATE TABLE IF NOT EXISTS usuarios_invitados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NULL,
    dni VARCHAR(20) NULL,
    telefono VARCHAR(20) NULL,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
    monto DECIMAL(10,2) NOT NULL DEFAULT 7.00,
    recargo_aplicado TINYINT(1) DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'activo',
    creado_por_admin_id INT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_usuarios_invitados_estado_fecha (estado, fecha_inicio, fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Configuración global del club
CREATE TABLE IF NOT EXISTS configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(50) NOT NULL UNIQUE,
    valor LONGTEXT NOT NULL
) ENGINE=InnoDB;

-- 11. Recompensas, canjes, convenios y ofertas
CREATE TABLE IF NOT EXISTS recompensas_catalogo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT NULL,
    costo_bambus INT NOT NULL DEFAULT 100,
    categoria VARCHAR(60) NOT NULL DEFAULT 'suplementos',
    imagen_url LONGTEXT NULL,
    stock INT DEFAULT 50,
    destacado TINYINT(1) DEFAULT 0,
    activo TINYINT(1) DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS convenios_comerciales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aliado_nombre VARCHAR(120) NOT NULL,
    categoria VARCHAR(60) NOT NULL DEFAULT 'Nutrición',
    imagen_url LONGTEXT NULL,
    descuento_texto VARCHAR(80) NOT NULL,
    descripcion TEXT NULL,
    codigo_promocional VARCHAR(50) DEFAULT 'PANDAFIT20',
    destacado TINYINT(1) DEFAULT 0,
    activo TINYINT(1) DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS canjes_recompensas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    recompensa_nombre VARCHAR(120) NOT NULL,
    costo_bambus INT NOT NULL,
    codigo_canje VARCHAR(30) DEFAULT 'PANDA-CANJE',
    fecha_canje TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(30) DEFAULT 'entregado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ofertas_socios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    tipo ENUM('descuento_porcentaje', 'descuento_fijo', 'dias_gratis', 'pase_amigo', 'personalizada') DEFAULT 'descuento_porcentaje',
    valor DECIMAL(10,2) DEFAULT 0.00,
    codigo_cupon VARCHAR(50) NULL,
    fecha_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin DATETIME NULL,
    estado ENUM('activo', 'canjeado', 'expirado') DEFAULT 'activo',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Biometría WebAuthn, ZKTeco y Lector USB
CREATE TABLE IF NOT EXISTS socio_dispositivos (
    usuario_id INT PRIMARY KEY,
    credential_id VARCHAR(1400) NOT NULL,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS socio_huellas_usb (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,
    dni VARCHAR(15) NOT NULL UNIQUE,
    template LONGTEXT NOT NULL,
    formato VARCHAR(40) NOT NULL DEFAULT 'ZKFINGER',
    dispositivo VARCHAR(80) NULL,
    actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asistencia_marcaciones_zk (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    dni VARCHAR(15) NOT NULL,
    fecha_hora DATETIME NOT NULL,
    origen VARCHAR(24) NOT NULL DEFAULT 'ZK_LIVE',
    dispositivo VARCHAR(80) NOT NULL DEFAULT 'ZKTECO',
    resultado VARCHAR(40) NOT NULL DEFAULT 'PROCESADO',
    detalle VARCHAR(200) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_zk_dni_fh (dni, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_member_links (
    staff_user_id INT PRIMARY KEY,
    member_user_id INT NOT NULL UNIQUE,
    linked_by INT NOT NULL,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nota: Ejecuta `npm run seed` dentro de `PROYECTO-REACT/backend` para poblar roles, usuarios y datos completos de prueba.
