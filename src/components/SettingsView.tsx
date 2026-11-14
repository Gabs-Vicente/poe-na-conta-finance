import type React from 'react'
import { formatMoneyInput, parseMoneyInput, type Card, type Category, type Data, type Participant } from '../finance'
import { dismissKeyboardOnEnter, type MainView } from '../utils/format'

type SettingsViewProps = {
  data: Data
  theme: 'light' | 'dark'
  defaultView: MainView
  defaultTheme: 'light' | 'dark'
  profileName: string
  profilePhoto: string
  profileMessage: string
  monthlyLimit: string
  limitNoticePercent: string
  isStandalone: boolean
  lastBackupAt: string
  changesSinceBackup: number
  storageWarning: string
  onUpdateProfileName: (value: string) => void
  onPickProfilePhoto: () => void
  onRemoveProfilePhoto: () => void
  onUpdateDefaultView: (view: MainView) => void
  onUpdateDefaultTheme: (theme: 'light' | 'dark') => void
  onUpdateMonthlyLimit: (value: string) => void
  onUpdateLimitNoticePercent: (value: string) => void
  onInstallPwa: () => void
  onOpenCategory: (category?: Category) => void
  onRemoveCategory: (id: string) => void
  onOpenCard: (card?: Card) => void
  onRemoveCard: (id: string) => void
  onOpenParticipant: (participant?: Participant) => void
  onRemoveParticipant: (id: string) => void
  onDownloadBackup: () => void
  onTriggerBackupImport: () => void
  onDownloadCsv: () => void
  onOpenResetDataModal: () => void
}

export function SettingsView({
  data,
  theme,
  defaultView,
  defaultTheme,
  profileName,
  profilePhoto,
  profileMessage,
  monthlyLimit,
  limitNoticePercent,
  isStandalone,
  lastBackupAt,
  changesSinceBackup,
  storageWarning,
  onUpdateProfileName,
  onPickProfilePhoto,
  onRemoveProfilePhoto,
  onUpdateDefaultView,
  onUpdateDefaultTheme,
  onUpdateMonthlyLimit,
  onUpdateLimitNoticePercent,
  onInstallPwa,
  onOpenCategory,
  onRemoveCategory,
  onOpenCard,
  onRemoveCard,
  onOpenParticipant,
  onRemoveParticipant,
  onDownloadBackup,
  onTriggerBackupImport,
  onDownloadCsv,
  onOpenResetDataModal,
}: SettingsViewProps) {
  const closeActionMenu = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.currentTarget.closest('details')?.removeAttribute('open')
    action()
  }

  return (
    <section className="settings-grid">
      <div className="panel settings-panel preference-panel" id="preferences-panel">
        <div className="panel-head">
          <div>
            <h2>Preferências</h2>
            <p>Personalize como o Põe na Conta abre e aparece.</p>
          </div>
          <span className="calendar-icon">⚙</span>
        </div>
        <div className="profile-preferences">
          <h3>Perfil</h3>
          <p>Defina como seu perfil aparece neste dispositivo.</p>
          <label>
            Nome
            <input type="text" maxLength={60} placeholder="Seu nome" value={profileName} onChange={event => onUpdateProfileName(event.target.value)} />
          </label>
          <div className="profile-photo-actions">
            <button type="button" className="outline-btn" onClick={onPickProfilePhoto}>
              {profilePhoto ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {profilePhoto && (
              <button type="button" className="text-btn" onClick={onRemoveProfilePhoto}>
                Remover foto
              </button>
            )}
          </div>
          {profileMessage && (
            <small className="profile-message" role="status">
              {profileMessage}
            </small>
          )}
        </div>
        <div className="preference-controls">
          <label>
            Tela ao abrir
            <select value={defaultView} onChange={event => onUpdateDefaultView(event.target.value as MainView)}>
              <option>Visão geral</option>
              <option>Lançamentos</option>
              <option>Relatórios</option>
              <option>Recorrências</option>
              <option>Ajustes</option>
            </select>
          </label>
          <label>
            Tema padrão
            <select value={defaultTheme} onChange={event => onUpdateDefaultTheme(event.target.value as 'light' | 'dark')}>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </label>
        </div>
        <div className="budget-preferences">
          <h3>Limite de gastos por mês</h3>
          <p>O limite considera apenas sua parte das despesas; valores de participantes ficam de fora.</p>
          <div className="budget-preference-fields">
            <label>
              Teto mensal
              <div className="money-input-wrap">
                <span className="money-prefix" aria-hidden="true">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  onKeyDown={dismissKeyboardOnEnter}
                  placeholder="0,00"
                  value={monthlyLimit ? formatMoneyInput(Number(monthlyLimit)) : ''}
                  onChange={event => {
                    const formatted = formatMoneyInput(event.target.value)
                    const parsed = parseMoneyInput(formatted)
                    onUpdateMonthlyLimit(parsed > 0 ? String(parsed) : '')
                  }}
                />
              </div>
            </label>
            <label>
              Avisar ao atingir
              <div className="money-input-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="done"
                  onKeyDown={dismissKeyboardOnEnter}
                  placeholder="80"
                  value={limitNoticePercent}
                  onChange={event => onUpdateLimitNoticePercent(event.target.value.replace(/\D/g, '').slice(0, 3))}
                />
                <span className="money-suffix" aria-hidden="true">%</span>
              </div>
            </label>
          </div>
        </div>
        <div className="pwa-preferences">
          <h3>Aplicativo neste dispositivo</h3>
          <p>
            {isStandalone
              ? 'O Põe na Conta já está instalado em tela cheia e funcionando 100% offline neste dispositivo.'
              : 'Adicione o ícone à tela inicial do celular ou computador para abrir em tela cheia e usar mesmo sem internet.'}
          </p>
          {isStandalone ? (
            <span className="pwa-status-badge">✓ Instalado · Modo tela cheia &amp; 100% offline ativo</span>
          ) : (
            <button type="button" className="outline-btn" onClick={onInstallPwa}>
              ↓ Instalar na tela inicial
            </button>
          )}
        </div>
      </div>
      <div className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h2>Categorias</h2>
            <p>Organize e identifique seus gastos.</p>
          </div>
          <button className="outline-btn" onClick={() => onOpenCategory()}>
            ＋ Nova categoria
          </button>
        </div>
        {data.categories.map(c => (
          <div className="setting-row" key={c.id}>
            <i className="dot" style={{ background: c.color }} />
            <b>{c.name}</b>
            <details className="row-actions">
              <summary aria-label={`Ações para a categoria ${c.name}`} title="Ações">···</summary>
              <div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}>
                <button onClick={event => closeActionMenu(event, () => onOpenCategory(c))}>Editar</button>
                <button className="danger" onClick={event => closeActionMenu(event, () => onRemoveCategory(c.id))}>
                  Remover
                </button>
              </div>
            </details>
          </div>
        ))}
      </div>
      <div className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h2>Cartões</h2>
            <p>Configure fechamento e vencimento da fatura.</p>
          </div>
          <button className="outline-btn" onClick={() => onOpenCard()}>
            ＋ Novo cartão
          </button>
        </div>
        {data.cards.map(c => (
          <div className="setting-row" key={c.id}>
            <span className="card-icon">▣</span>
            <b>{c.name}</b>
            <span className="card-days">Fecha dia {c.closingDay} · Vence dia {c.dueDay}</span>
            <details className="row-actions">
              <summary aria-label={`Ações para o cartão ${c.name}`} title="Ações">···</summary>
              <div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}>
                <button onClick={event => closeActionMenu(event, () => onOpenCard(c))}>Editar</button>
                <button className="danger" onClick={event => closeActionMenu(event, () => onRemoveCard(c.id))}>
                  Remover
                </button>
              </div>
            </details>
          </div>
        ))}
      </div>
      <div className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h2>Participantes</h2>
            <p>Pessoas que dividem despesas com você.</p>
          </div>
          <button className="outline-btn" onClick={() => onOpenParticipant()}>
            ＋ Novo participante
          </button>
        </div>
        {(data.participants || []).length ? (
          (data.participants || []).map(participant => (
            <div className="setting-row" key={participant.id}>
              <span className="participant-avatar">{participant.name.slice(0, 1).toUpperCase()}</span>
              <b>{participant.name}</b>
              <details className="row-actions">
                <summary aria-label={`Ações para ${participant.name}`} title="Ações">···</summary>
                <div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}>
                  <button onClick={event => closeActionMenu(event, () => onOpenParticipant(participant))}>Editar</button>
                  <button className="danger" onClick={event => closeActionMenu(event, () => onRemoveParticipant(participant.id))}>
                    Remover
                  </button>
                </div>
              </details>
            </div>
          ))
        ) : (
          <div className="empty compact">Adicione pessoas para acompanhar o que elas precisam reembolsar.</div>
        )}
      </div>
      <div className="panel backup">
        <h2>Seus dados</h2>
        <p>Os lançamentos ficam salvos localmente neste navegador. Baixe um backup completo para preservar categorias, cartões, participantes e despesas.</p>
        <div className="backup-status-row">
          <span>
            {lastBackupAt
              ? `✓ Último backup: ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(lastBackupAt))}`
              : '⚠ Nenhum backup baixado neste dispositivo ainda'}
          </span>
          {lastBackupAt && (
            <small>
              {changesSinceBackup > 0 ? `${changesSinceBackup} ${changesSinceBackup === 1 ? 'alteração desde então' : 'alterações desde então'}` : 'Tudo atualizado'}
            </small>
          )}
        </div>
        <div className="backup-actions">
          <button className="outline-btn" onClick={onDownloadBackup}>
            Baixar backup JSON
          </button>
          <button className="outline-btn" onClick={onTriggerBackupImport}>
            Importar backup
          </button>
          <button className="outline-btn" onClick={onDownloadCsv}>
            ↓ Exportar mês em CSV
          </button>
          <button type="button" className="danger-outline-btn" onClick={onOpenResetDataModal}>
            Excluir dados
          </button>
        </div>
        {storageWarning && (
          <p className="backup-warning" role="alert">
            {storageWarning}
          </p>
        )}
      </div>
    </section>
  )
}
