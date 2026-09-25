import { EstadoNumero, Numero } from './types';

class AgendaControlRifa {
  private numeros: Numero[] = [];
  private numeroSeleccionado: number | null = null;
  private readonly PRECIO_BOLETO: number = 10000; // 💵 $10.000 ARS

  // 📱 CONFIGURACIÓN DE CONTACTO Y DESPLIEGUE
  private readonly TELEFONO_ADMINISTRADORA: string = '5492926466613';
  private readonly URL_APP_VERCEL: string = 'https://agenda-control-rifa.pages.dev';

  constructor() {
    this.cargarDatos();
    this.render();
  }

  private cargarDatos(): void {
    const dataGuardada = localStorage.getItem('rifa_agenda_interna');
    if (dataGuardada) {
      this.numeros = JSON.parse(dataGuardada);
    } else {
      // Crear los 100 números (00 al 99)
      this.numeros = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        estado: 'disponible'
      }));
      this.guardarDatos();
    }
  }

  private guardarDatos(): void {
    localStorage.setItem('rifa_agenda_interna', JSON.stringify(this.numeros));
  }

  // 💾 DESCARGAR COPIA DE SEGURIDAD (BACKUP JSON)
  public descargarBackup(): void {
    const data = localStorage.getItem('rifa_agenda_interna');
    if (!data) {
      alert('No hay datos registrados para exportar.');
      return;
    }

    const fecha = new Date().toISOString().split('T')[0];
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_rifa_${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 📤 RESTAURAR COPIA DE SEGURIDAD DESDE UN ARCHIVO JSON
  public restaurarBackup(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const contenido = event.target?.result as string;
        const datosParseados = JSON.parse(contenido);

        if (Array.isArray(datosParseados) && datosParseados.length === 100) {
          if (confirm('⚠️ ¿Estás segura de restaurar este respaldo? Se sobrescribirán los datos actuales.')) {
            localStorage.setItem('rifa_agenda_interna', contenido);
            this.cargarDatos();
            this.render();
            alert('✅ Respaldo restaurado con éxito.');
          }
        } else {
          alert('❌ El archivo seleccionado no tiene el formato válido de la rifa.');
        }
      } catch (err) {
        alert('❌ Error al leer el archivo de respaldo.');
      }
    };

    reader.readAsText(file);
  }

  // 🔔 MODAL ELEGANTE DE CONFIRMACIÓN (SOLO PARA NÚMEROS OCUPADOS)
  private pedirConfirmacion(mensaje: string): Promise<boolean> {
    return new Promise((resolve) => {
      const numFormateado = String(this.numeroSeleccionado).padStart(2, '0');
      const dialogHTML = `
        <dialog id="modal-confirmar" open>
          <article style="max-width: 400px;">
            <header>
              <button aria-label="Cerrar" class="close" id="btn-cancelar-x"></button>
              <strong>⚠️ Confirmar Modificación</strong>
            </header>
            <p style="margin-bottom: 1rem;">${mensaje}</p>
            <footer style="display: flex; gap: 0.5rem; justify-content: flex-end;">
              <button class="secondary outline" id="btn-cancelar-modal" style="width: auto;">Cancelar</button>
              <button class="contrast" id="btn-aceptar-modal" style="width: auto;">Sí, modificar N° ${numFormateado}</button>
            </footer>
          </article>
        </dialog>
      `;

      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      const dialog = document.getElementById('modal-confirmar') as HTMLDialogElement;
      const btnAceptar = document.getElementById('btn-aceptar-modal');
      const btnCancelar = document.getElementById('btn-cancelar-modal');
      const btnCancelarX = document.getElementById('btn-cancelar-x');

      const cerrar = (confirmado: boolean) => {
        dialog?.remove();
        resolve(confirmado);
      };

      btnAceptar?.addEventListener('click', () => cerrar(true));
      btnCancelar?.addEventListener('click', () => cerrar(false));
      btnCancelarX?.addEventListener('click', () => cerrar(false));
    });
  }

  // 📝 MANEJAR CLIC EN CUALQUIER NÚMERO
  public async manejarClicNumero(numeroId: number): Promise<void> {
    this.numeroSeleccionado = numeroId;
    const num = this.numeros.find(n => n.id === numeroId);

    if (!num) return;

    // Verificar si el número tiene un comprador asignado o está ocupado/reservado
    const estaOcupado = num.estado !== 'disponible' || (num.comprador && num.comprador.nombre.trim() !== '');

    if (estaOcupado) {
      const nombreComprador = num.comprador?.nombre || 'un comprador';
      const estadoTexto = num.estado === 'pagado' ? 'PAGADO' : 'PENDIENTE DE PAGO';
      
      const confirmado = await this.pedirConfirmacion(
        `El boleto <b>N° ${String(numeroId).padStart(2, '0')}</b> está asignado a <b>${nombreComprador}</b> (${estadoTexto}).<br><br>¿Estás segura de que deseas ver o cambiar sus datos?`
      );

      if (!confirmado) {
        this.numeroSeleccionado = null;
        return; // Cancelar si presionó 'Cancelar' o la 'X'
      }
    }

    // Si estaba libre O si confirmó que desea modificarlo, abre el formulario
    this.renderModal();
  }

  // 💾 GUARDAR FICHA DEL COMPRADOR
  public guardarRegistro(e: Event): void {
    e.preventDefault();
    if (this.numeroSeleccionado === null) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const estado = formData.get('estado') as EstadoNumero;
    const num = this.numeros.find(n => n.id === this.numeroSeleccionado);

    if (num) {
      num.estado = estado;
      
      const nombre = formData.get('nombre') as string;
      const telefono = formData.get('telefono') as string;
      const metodoPago = formData.get('metodoPago') as string;
      const notas = formData.get('notas') as string;

      if (estado !== 'disponible') {
        num.comprador = {
          nombre,
          telefono,
          vendedor: '',
          metodoPago,
          notas,
          fechaRegistro: new Date().toLocaleDateString()
        };
      } else {
        delete num.comprador; // Si se vuelve a disponible, se borra el registro
      }

      this.guardarDatos();
      this.cerrarModal();
      this.render(); // Se actualiza la pantalla al instante para seguir anotando
    }
  }

  public cerrarModal(): void {
    this.numeroSeleccionado = null;
    document.getElementById('modal-registro')?.remove();
  }

  private renderModal(): void {
    if (this.numeroSeleccionado === null) return;
    const num = this.numeros.find(n => n.id === this.numeroSeleccionado);
    if (!num) return;

    const comp = num.comprador || { nombre: '', telefono: '', metodoPago: 'Transferencia / MercadoPago', notas: '' };
    const numFormateado = String(num.id).padStart(2, '0');

    const modalHTML = `
      <dialog id="modal-registro" open>
        <article style="max-width: 480px;">
          <header>
            <button aria-label="Cerrar" class="close" id="btn-cerrar-modal"></button>
            <h3>📝 Registro Boleto N° ${numFormateado}</h3>
          </header>
          <form id="form-registro">
            <label for="estado">Estado del Boleto</label>
            <select name="estado" id="estado" required>
              <option value="disponible" ${num.estado === 'disponible' ? 'selected' : ''}>Sin vender (Libre) 🟢</option>
              <option value="reservado" ${num.estado === 'reservado' ? 'selected' : ''}>Pago pendiente 🟡</option>
              <option value="pagado" ${num.estado === 'pagado' ? 'selected' : ''}>Pagado 🔴</option>
            </select>

            <label for="nombre">Nombre y Apellido</label>
            <input type="text" name="nombre" value="${comp.nombre}" placeholder="Ej: Juan Pérez" ${num.estado !== 'disponible' ? 'required' : ''}>

            <label for="telefono">WhatsApp Cliente</label>
            <input type="tel" name="telefono" value="${comp.telefono}" placeholder="Ej: 1112345678">

            <label for="metodoPago">Medio de Pago</label>
            <select name="metodoPago">
              <option value="Transferencia / MercadoPago" ${comp.metodoPago === 'Transferencia / MercadoPago' ? 'selected' : ''}>Transferencia / MercadoPago</option>
              <option value="Efectivo" ${comp.metodoPago === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
            </select>

            <label for="notas">Notas / Observaciones</label>
            <textarea name="notas" placeholder="Ej: Anotó 10 números juntos">${comp.notas || ''}</textarea>

            <footer>
              <button type="submit" class="primary">Guardar Boleto</button>
            </footer>
          </form>
        </article>
      </dialog>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-cerrar-modal')?.addEventListener('click', () => this.cerrarModal());
    document.getElementById('form-registro')?.addEventListener('submit', (e) => this.guardarRegistro(e));
  }

  // 📲 ENVIAR DISPONIBLES AL WHATSAPP DE LA ADMINISTRADORA
  public enviarDisponiblesAdmin(): void {
    const disponibles = this.numeros
      .filter(n => n.estado === 'disponible')
      .map(n => String(n.id).padStart(2, '0'));

    if (disponibles.length === 0) {
      alert(`¡Agotado total! No quedan números libres. 🎉`);
      return;
    }

    const mensaje = 
`🎟️ *GRAN RIFA - NÚMEROS DISPONIBLES*
💰 *Valor por número:* $${this.PRECIO_BOLETO.toLocaleString()}

🟢 *Libres (${disponibles.length} de 100):*
${disponibles.join(', ')}

📲 *¡Escribinos para reservar el tuyo!*

🌐 *Acceder al sistema:*
${this.URL_APP_VERCEL}`;

    const urlWhatsApp = `https://api.whatsapp.com/send?phone=${this.TELEFONO_ADMINISTRADORA}&text=${encodeURIComponent(mensaje)}`;
    window.open(urlWhatsApp, '_blank');
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    const pagados = this.numeros.filter(n => n.estado === 'pagado').length;
    const reservados = this.numeros.filter(n => n.estado === 'reservado').length;
    const disponibles = this.numeros.filter(n => n.estado === 'disponible').length;
    const recaudado = pagados * this.PRECIO_BOLETO;

    const listaOcupados = this.numeros.filter(n => n.estado !== 'disponible');

    app.innerHTML = `
      <header style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1>📖 Agenda de Control de Rifa</h1>
            <p><small>Sorteo de 100 Números (00 - 99) | Valor: <b>$10.000</b></small></p>
          </div>

          <!-- BOTONES DE RESPALDO Y RESTAURACIÓN DE DATOS -->
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button 
              class="outline secondary" 
              style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" 
              onclick="window.app.descargarBackup()">
              💾 Descargar Respaldo
            </button>

            <label 
              class="button outline secondary" 
              style="font-size: 0.8rem; padding: 0.4rem 0.8rem; margin: 0; cursor: pointer;">
              📂 Cargar Respaldo
              <input 
                type="file" 
                accept=".json" 
                style="display: none;" 
                onchange="window.app.restaurarBackup(event)">
            </label>
          </div>
        </div>
      </header>

      <!-- Resumen de Caja y Estados -->
      <section class="grid" style="margin-bottom: 1.5rem;">
        <article style="background-color: var(--pico-card-background-color);">
          <small>Recaudación Total</small>
          <h2 style="color: #10b981;">$${recaudado.toLocaleString()}</h2>
        </article>
        <article style="background-color: var(--pico-card-background-color);">
          <small>Pagados</small>
          <h2 style="color: #ef4444;">${pagados} / 100</h2>
        </article>
        <article style="background-color: var(--pico-card-background-color);">
          <small>Pago Pendiente</small>
          <h2 style="color: #f59e0b;">${reservados}</h2>
        </article>
        <article style="background-color: var(--pico-card-background-color);">
          <small>Sin Vender</small>
          <h2 style="color: #10b981;">${disponibles}</h2>
        </article>
      </section>

      <!-- Grilla de Botones -->
      <main>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <h3>Grilla de Boletos</h3>
          
          <button 
            class="outline contrast" 
            style="border-color: #25D366; color: #25D366; font-weight: bold;"
            onclick="window.app.enviarDisponiblesAdmin()">
            📲 Enviar Libres por WhatsApp
          </button>
        </div>

        <!-- Leyenda de colores -->
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.85rem;">
          <span>🟢 <b>Sin vender</b></span>
          <span>🟡 <b>Pago pendiente</b></span>
          <span>🔴 <b>Pagado</b></span>
        </div>

        <div class="grid-numeros">
          ${this.numeros.map(n => {
            const numPadded = String(n.id).padStart(2, '0');
            return `
              <button 
                class="btn-numero ${n.estado}"
                onclick="window.app.manejarClicNumero(${n.id})"
                title="${n.comprador ? `${n.comprador.nombre} (${n.comprador.telefono})` : 'Sin vender'}">
                ${numPadded}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Tabla / Planilla de Control -->
        <section style="margin-top: 2.5rem;">
          <h3>📋 Planilla de Control (${listaOcupados.length} Registrados)</h3>
          
          ${listaOcupados.length === 0 ? '<p><small>Aún no hay números anotados.</small></p>' : `
            <figure style="overflow-x: auto;">
              <table>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Estado</th>
                    <th>Comprador</th>
                    <th>WhatsApp</th>
                    <th>Pago</th>
                    <th>Notas</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${listaOcupados.map(n => `
                    <tr>
                      <td><b>N° ${String(n.id).padStart(2, '0')}</b></td>
                      <td>
                        <span style="color: ${n.estado === 'pagado' ? '#ef4444' : '#f59e0b'}; font-weight: bold;">
                          ${n.estado === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                        </span>
                      </td>
                      <td>${n.comprador?.nombre || '-'}</td>
                      <td>
                        ${n.comprador?.telefono ? `
                          <a href="https://api.whatsapp.com/send?phone=${n.comprador.telefono.replace(/\D/g, '')}" target="_blank">
                            📲 ${n.comprador.telefono}
                          </a>
                        ` : '-'}
                      </td>
                      <td><small>${n.comprador?.metodoPago || '-'}</small></td>
                      <td><small>${n.comprador?.notas || '-'}</small></td>
                      <td>
                        <button class="outline secondary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="window.app.manejarClicNumero(${n.id})">
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </figure>
          `}
        </section>
      </main>
    `;
  }
}

declare global {
  interface Window {
    app: AgendaControlRifa;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AgendaControlRifa();
});