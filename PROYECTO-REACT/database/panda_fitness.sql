create database panda_fitness;

use panda_fitness;

-- 1. Tabla de roles
-- =============================================
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO roles (nombre) VALUES ('admin'), ('cliente');

-- 2. Tabla de usuarios
-- =============================================
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(8) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(9) DEFAULT NULL,
    rol_id INT NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo TINYINT(1) DEFAULT 1,
    FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

INSERT INTO usuarios (nombre, apellido, dni, email, password_hash, telefono, rol_id) 
VALUES ('Administrador', 'General', '00000000', 'admin@gmail.com', 'admin@123', '999999999', 1);

select * from usuarios;

-- =============================================
-- 3. Planes de membresía
-- =============================================
CREATE TABLE planes_membresia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    duracion_dias INT NOT NULL,
    limite_semanal INT DEFAULT NULL,
    total_reservas INT DEFAULT NULL,
    precio DECIMAL(10,2) NOT NULL,
    descripcion TEXT
) ENGINE=InnoDB;

INSERT INTO planes_membresia (nombre, duracion_dias, limite_semanal, total_reservas, precio, descripcion)
VALUES ('Mensual', 30, NULL, NULL, 80, 'Plan mensual'),
       ('Bimestral', 60, NULL, NULL, 150, 'Promoción de 2 meses'),
       ('Trimestral', 90, NULL, NULL, 200, 'Promoción de 3 meses'),
       ('Interdiario', 15, 3, 15, 50, 'Plan especial con 3 reservas por semana. max 15 días'),
       ('Anual', 365, NULL, NULL, 800, 'Super promoción de un año');

-- =============================================
-- 4. Membresías de los clientes
-- =============================================
CREATE TABLE membresias (
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

-- =============================================
-- 5. Pagos
-- =============================================
CREATE TABLE pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha_pago DATE NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    membresia_id INT DEFAULT NULL,           -- membresía que se pagó
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (membresia_id) REFERENCES membresias(id) ON DELETE SET NULL,
    INDEX idx_usuario_fecha (usuario_id, fecha_pago)
) ENGINE=InnoDB;

-- =============================================
-- 6. Reservas (con tolerancia de 15 min)
-- =============================================
CREATE TABLE reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    hora_entrada DATETIME NOT NULL,
    hora_salida DATETIME NOT NULL,
    estado ENUM('pendiente', 'confirmada', 'cancelada', 'no_show', 'finalizada') DEFAULT 'pendiente',
    tipo ENUM('normal') NOT NULL DEFAULT 'normal',
    reserva_origen_id INT NULL,
    duracion_minutos INT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_usuario_entrada (usuario_id, hora_entrada),
    INDEX idx_estado_hora (estado, hora_entrada),
    CONSTRAINT chk_horario CHECK (hora_salida > hora_entrada)
) ENGINE=InnoDB;

-- =============================================
-- 7. Asistencias (registro de entradas/salidas)
-- =============================================
CREATE TABLE asistencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reserva_id INT NOT NULL,
    usuario_id INT NOT NULL,
    hora_entrada DATETIME NOT NULL,
    hora_salida DATETIME DEFAULT NULL,
    FOREIGN KEY (reserva_id) REFERENCES reservas(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_activos (hora_salida),         -- para contar quién está dentro
    INDEX idx_usuario_fecha (usuario_id, hora_entrada)
) ENGINE=InnoDB;

-- =============================================
-- 8. Configuración global (aforo máximo, etc.)
-- =============================================
CREATE TABLE configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(50) NOT NULL UNIQUE,
    valor VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

INSERT INTO configuracion (clave, valor) VALUES ('max_capacidad', '50');