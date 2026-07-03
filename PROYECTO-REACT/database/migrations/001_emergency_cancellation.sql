-- Migracion: cancelacion por emergencia y reservas de reintegro
USE panda_fitness;

ALTER TABLE reservas
    MODIFY estado ENUM(
        'pendiente',
        'confirmada',
        'cancelada',
        'cancelada_emergencia',
        'no_show',
        'finalizada'
    ) DEFAULT 'pendiente';

ALTER TABLE reservas
    ADD COLUMN IF NOT EXISTS tipo ENUM('normal', 'reintegro_emergencia') NOT NULL DEFAULT 'normal' AFTER estado,
    ADD COLUMN IF NOT EXISTS reserva_origen_id INT NULL AFTER tipo,
    ADD COLUMN IF NOT EXISTS duracion_minutos INT NULL AFTER reserva_origen_id,
    ADD COLUMN IF NOT EXISTS cancelada_emergencia TINYINT(1) NOT NULL DEFAULT 0 AFTER duracion_minutos;

-- Nota: IF NOT EXISTS en ADD COLUMN requiere MySQL 8.0.12+.
-- Si falla, ejecutar cada ALTER por separado omitiendo columnas ya existentes.
