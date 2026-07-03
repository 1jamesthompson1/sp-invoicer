      // --- Dark mode logic: auto, light, dark ---
      function setDarkMode(mode) {
        // mode: 'auto', 'light', 'dark'
        if (mode === 'dark') {
          document.documentElement.classList.add('dark-mode');
          document.body.classList.add('dark-mode');
          document.documentElement.classList.remove('light-mode');
          document.body.classList.remove('light-mode');
        } else if (mode === 'light') {
          document.documentElement.classList.remove('dark-mode');
          document.body.classList.remove('dark-mode');
          document.documentElement.classList.add('light-mode');
          document.body.classList.add('light-mode');
        } else {
          // auto: remove both, let prefers-color-scheme CSS apply
          document.documentElement.classList.remove('dark-mode');
          document.body.classList.remove('dark-mode');
          document.documentElement.classList.remove('light-mode');
          document.body.classList.remove('light-mode');
        }
        localStorage.setItem('sp-invoicer-dark-mode', mode);
      }

      function getDarkModePref() {
        return localStorage.getItem('sp-invoicer-dark-mode') || 'auto';
      }

      function getSystemDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      function setupDarkModeToggle() {
        const select = document.getElementById('dark-mode-toggle');
        if (!select) return;
        
        const pref = getDarkModePref();
        select.value = pref;
        
        // For auto mode, check system preference
        if (pref === 'auto') {
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
          }
        } else {
          setDarkMode(pref);
        }
        
        select.onchange = () => {
          setDarkMode(select.value);
        };
      }

      // Listen for system theme changes if in auto mode
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (getDarkModePref() === 'auto') {
          setDarkMode('auto');
        }
      });

      window.addEventListener('DOMContentLoaded', setupDarkModeToggle);
      // State management
      let profiles = [];
      let selectedProfileId = null;
      let clients = [];
      let projectAssignments = {};
      let projects = [];
      let editingClientId = null;
      let generatedInvoices = []; // Store generated invoices with their numbers
      let lastPersistAt = 0;
      let pendingInvoiceData = null;
      let hasPendingInvoiceSaved = false;

      function createDefaultProfile() {
        return {
          id: Date.now().toString(),
          profileName: 'Default',
          businessName: '',
          email: '',
          phone: '',
          address: '',
          website: '',
          taxIdLabel: 'Tax ID',
          taxId: '',
          taxName: 'VAT',
          taxRate: 0,
          taxEnabled: false,
          bankDetails: '',
          invoiceTitle: 'Invoice',
          invoiceMessage: 'Thank you for your business!',
          roundMode: 'round',
          roundEntry: 0,
          roundMerged: 0,
          roundProject: 0,
          dueDays: 30
        };
      }

      function getDefaultProfile() {
        return profiles[0] || null;
      }

      function getProfileById(id) {
        return profiles.find(p => p.id === id) || null;
      }

      function getClientProfile(client) {
        if (client.profileId) {
          const profile = getProfileById(client.profileId);
          if (profile) return profile;
        }
        return getDefaultProfile();
      }

      // Initialize
      async function init() {
        await loadData();
        await loadProjects();
        
        // Ensure at least one profile
        if (profiles.length === 0) {
          profiles = [createDefaultProfile()];
          await saveData();
        }
        
        // Ensure profile ID
        profiles.forEach(p => {
          if (!p.id) p.id = Date.now().toString();
        });
        
        selectedProfileId = profiles[0].id;
        
        // Create example client on first install if no clients exist
        if (!clients || clients.length === 0) {
          clients = [{
            id: 'example-client-' + Date.now(),
            name: 'Example Client Inc.',
            email: 'john@example.com',
            address: '123 Business Street, Suite 100',
            taxRate: 20,
            taxName: 'VAT',
            hourlyRate: 100,
            taxEnabled: true,
            dueDays: null,
            profileId: ''
          }];
          await saveData();
        }
        
        renderMyDetails();
        renderClients();
        renderProjectAssignments();
        updateProjectSelect();
        updateClientSelect();
        updateGenerateClientSelect();
        updateClientProfileSelect();
        renderInvoices();
        setDefaultInvoiceDate();
        setupPrintShortcut();
      }

      async function finalizeInvoiceSave() {
        if (!pendingInvoiceData || hasPendingInvoiceSaved) return;
        if (generatedInvoices.some(inv => inv.number === pendingInvoiceData.number)) {
          hasPendingInvoiceSaved = true;
          return;
        }

        generatedInvoices.push(pendingInvoiceData);
        await saveData();
        renderInvoices();
        hasPendingInvoiceSaved = true;
      }
          // Render all generated invoices in the Invoices tab
          function renderInvoices() {
            const invoicesList = document.getElementById('invoices-list');
            if (!invoicesList) return;

            function isDarkMode() {
              return document.documentElement.classList.contains('dark-mode') || 
                document.body.classList.contains('dark-mode') ||
                (!document.documentElement.classList.contains('light-mode') && 
                 !document.body.classList.contains('light-mode') && 
                 window.matchMedia('(prefers-color-scheme: dark)').matches);
            }

            if (generatedInvoices.length === 0) {
              invoicesList.innerHTML = '<p class="empty-state">No invoices generated yet.</p>';
              return;
            }
            
            const html = `
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Period</th>
                    <th style="text-align: right;">Total</th>
                    <th>Created</th>
                    <th style="text-align: center;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${generatedInvoices.map((invoice, index) => {
                    const createdDate = new Date(invoice.createdAt).toLocaleDateString();
                    return `
                      <tr>
                        <td><strong>${invoice.number}</strong></td>
                        <td>${invoice.clientName}</td>
                        <td>${new Date(invoice.date).toLocaleDateString()}</td>
                        <td>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</td>
                        <td class="period">${invoice.period}</td>
                        <td style="text-align: right;"><strong>$${invoice.total.toFixed(2)}</strong></td>
                        <td class="created">${createdDate}</td>
                        <td style="text-align: center;">
                          <button onclick="deleteInvoice(${index})">Delete</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `;
            invoicesList.innerHTML = html;
          }

          window.deleteInvoice = function(index) {
            if (confirm('Are you sure you want to delete this invoice?')) {
              generatedInvoices.splice(index, 1);
              saveData();
              renderInvoices();
              PluginAPI.showSnack({ msg: 'Invoice deleted', type: 'SUCCESS' });
            }
          };


      // Load data from storage
        // Generate unique invoice number
        function generateInvoiceNumber() {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const prefix = `INV-${year}${month}-`;

          const existingNumbers = new Set(
            generatedInvoices
              .map(inv => inv.number)
              .filter(number => number && number.startsWith(prefix))
          );

          const max = 99999;
          const min = 0;
          const getRandomInt = () => {
            if (window.crypto && window.crypto.getRandomValues) {
              const buffer = new Uint32Array(1);
              window.crypto.getRandomValues(buffer);
              return min + (buffer[0] % (max - min + 1));
            }
            return Math.floor(Math.random() * (max - min + 1)) + min;
          };

          for (let attempt = 0; attempt < 20; attempt += 1) {
            const randomPart = String(getRandomInt()).padStart(5, '0');
            const candidate = `${prefix}${randomPart}`;
            if (!existingNumbers.has(candidate)) {
              return candidate;
            }
          }

          return `${prefix}${String(Date.now()).slice(-5)}`;
        }

        function setupPrintShortcut() {
          window.addEventListener('keydown', (event) => {
            const isPrint = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p';
            if (!isPrint) return;

            const iframe = document.querySelector('#invoice-iframe-container iframe');
            if (!iframe || !iframe.contentWindow) return;

            event.preventDefault();
            finalizeInvoiceSave();
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          });
        }

      async function loadData() {
        try {
          const data = await PluginAPI.loadSyncedData();
          if (data) {
            const parsed = JSON.parse(data);
            profiles = parsed.profiles || [];
            clients = parsed.clients || [];
            projectAssignments = parsed.projectAssignments || {};
            generatedInvoices = parsed.generatedInvoices || [];

            // Migrate old single-profile format
            if (parsed.myDetails && (!parsed.profiles || parsed.profiles.length === 0)) {
              const old = parsed.myDetails;
              profiles = [{
                id: Date.now().toString(),
                profileName: 'Default',
                businessName: old.name || '',
                email: old.email || '',
                phone: old.phone || '',
                address: old.address || '',
                website: old.website || '',
                taxIdLabel: old.taxIdLabel || 'Tax ID',
                taxId: old.taxId || '',
                taxName: old.taxName || 'VAT',
                taxRate: old.taxRate || 0,
                taxEnabled: old.taxEnabled || false,
                bankDetails: old.bankDetails || '',
                invoiceTitle: old.invoiceTitle || 'Invoice',
                invoiceMessage: old.invoiceMessage || 'Thank you for your business!',
                roundMode: old.roundMode || 'round',
                roundEntry: old.roundEntry || 0,
                roundMerged: old.roundMerged || 0,
                roundProject: old.roundProject || 0,
                dueDays: old.dueDays ?? 30
              }];
            }
          }
        } catch (error) {
          console.error('Error loading data:', error);
        }
      }

      // Save data to storage
      async function saveData() {
        try {
          const now = Date.now();
          const elapsed = now - lastPersistAt;
          if (elapsed < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
          }
          const data = JSON.stringify({
            profiles: profiles,
            clients: clients,
            projectAssignments: projectAssignments,
            generatedInvoices: generatedInvoices
          });
          await PluginAPI.persistDataSynced(data);
          lastPersistAt = Date.now();
        } catch (error) {
          console.error('Error saving data:', error);
          PluginAPI.showSnack({
            msg: 'Error saving data',
            type: 'ERROR'
          });
        }
      }

      // Load projects from Super Productivity
      async function loadProjects() {
        try {
          projects = await PluginAPI.getAllProjects();
        } catch (error) {
          console.error('Error loading projects:', error);
          PluginAPI.showSnack({
            msg: 'Error loading projects',
            type: 'ERROR'
          });
        }
      }

      // Update profile select dropdown
      function updateProfileSelect() {
        const select = document.getElementById('profile-select');
        const currentVal = selectedProfileId;
        select.innerHTML = '';
        profiles.forEach(p => {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = p.profileName || 'Unnamed Profile';
          select.appendChild(option);
        });
        if (profiles.some(p => p.id === currentVal)) {
          select.value = currentVal;
        }
      }

      // Profile selector change
      document.getElementById('profile-select').addEventListener('change', (e) => {
        selectedProfileId = e.target.value;
        renderMyDetails();
      });

      // Toggle profile tax fields visibility
      function toggleProfileTaxFields() {
        const enabled = document.getElementById('my-tax-enabled').checked;
        document.getElementById('my-tax-fields').style.display = enabled ? 'block' : 'none';
      }
      document.getElementById('my-tax-enabled').addEventListener('change', toggleProfileTaxFields);

      // Add profile
      document.getElementById('profile-add').addEventListener('click', async () => {
        const currentProfile = getProfileById(selectedProfileId);
        const newProfile = currentProfile ? JSON.parse(JSON.stringify(currentProfile)) : createDefaultProfile();
        newProfile.id = Date.now().toString();
        newProfile.profileName = (currentProfile ? currentProfile.profileName + ' (Copy)' : 'New Profile');
        profiles.push(newProfile);
        selectedProfileId = newProfile.id;
        await saveData();
        updateProfileSelect();
        renderMyDetails();
        PluginAPI.showSnack({
          msg: 'Profile added',
          type: 'SUCCESS'
        });
      });

      // Delete profile
      document.getElementById('profile-delete').addEventListener('click', async () => {
        if (profiles.length <= 1) {
          PluginAPI.showSnack({
            msg: 'Cannot delete the only profile',
            type: 'WARNING'
          });
          return;
        }
        const confirmed = await PluginAPI.openDialog({
          title: 'Delete Profile',
          content: 'Are you sure you want to delete this profile? Clients using this profile will fall back to the default.',
          okBtnLabel: 'Delete',
          cancelBtnLabel: 'Cancel'
        });
        if (confirmed) {
          const idx = profiles.findIndex(p => p.id === selectedProfileId);
          if (idx > -1) {
            profiles.splice(idx, 1);
            selectedProfileId = profiles[0].id;
            // Clear profileId from clients using deleted profile
            clients.forEach(c => {
              if (c.profileId && !profiles.some(p => p.id === c.profileId)) {
                c.profileId = '';
              }
            });
            await saveData();
            updateProfileSelect();
            renderMyDetails();
            renderClients();
            PluginAPI.showSnack({
              msg: 'Profile deleted',
              type: 'SUCCESS'
            });
          }
        }
      });

      // My Details form submission
      document.getElementById('mydetails-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const profile = getProfileById(selectedProfileId);
        if (!profile) {
          PluginAPI.showSnack({ msg: 'No profile selected', type: 'ERROR' });
          return;
        }

        profile.profileName = document.getElementById('my-profile-name').value || 'Unnamed Profile';
        profile.businessName = document.getElementById('my-name').value;
        profile.email = document.getElementById('my-email').value;
        profile.phone = document.getElementById('my-phone').value;
        profile.address = document.getElementById('my-address').value;
        profile.website = document.getElementById('my-website').value;
        profile.taxIdLabel = document.getElementById('my-tax-id-label').value || 'Tax ID';
        profile.taxId = document.getElementById('my-tax-id').value;
        profile.taxName = document.getElementById('my-tax-name').value || 'VAT';
        profile.taxRate = parseFloat(document.getElementById('my-tax-rate').value) || 0;
        profile.taxEnabled = document.getElementById('my-tax-enabled').checked;
        profile.bankDetails = document.getElementById('my-bank').value;
        profile.invoiceTitle = document.getElementById('my-invoice-title').value || 'Invoice';
        profile.invoiceMessage = document.getElementById('my-invoice-message').value || 'Thank you for your business!';
        profile.roundMode = document.getElementById('my-round-mode').value || 'round';
        profile.roundEntry = parseInt(document.getElementById('my-round-entry').value) || 0;
        profile.roundMerged = parseInt(document.getElementById('my-round-merged').value) || 0;
        profile.roundProject = parseInt(document.getElementById('my-round-project').value) || 0;
        const dueVal = parseInt(document.getElementById('my-due-days').value);
        profile.dueDays = Number.isNaN(dueVal) ? 30 : dueVal;

        await saveData();
        updateProfileSelect();
        renderMyDetails();

        PluginAPI.showSnack({
          msg: 'Profile saved successfully',
          type: 'SUCCESS'
        });
      });

      // Render my details
      function renderMyDetails() {
        const profile = getProfileById(selectedProfileId);
        if (!profile) return;

        // Populate form
        updateProfileSelect();
        document.getElementById('my-profile-name').value = profile.profileName || '';
        document.getElementById('my-name').value = profile.businessName || '';
        document.getElementById('my-email').value = profile.email || '';
        document.getElementById('my-phone').value = profile.phone || '';
        document.getElementById('my-address').value = profile.address || '';
        document.getElementById('my-website').value = profile.website || '';
        document.getElementById('my-tax-id-label').value = profile.taxIdLabel || 'Tax ID';
        document.getElementById('my-tax-id').value = profile.taxId || '';
        document.getElementById('my-tax-name').value = profile.taxName || 'VAT';
        document.getElementById('my-tax-rate').value = profile.taxRate || 0;
        document.getElementById('my-tax-enabled').checked = !!profile.taxEnabled;
        toggleProfileTaxFields();
        document.getElementById('my-bank').value = profile.bankDetails || '';
        document.getElementById('my-invoice-title').value = profile.invoiceTitle || 'Invoice';
        document.getElementById('my-invoice-message').value = profile.invoiceMessage || 'Thank you for your business!';
        document.getElementById('my-round-mode').value = profile.roundMode || 'round';
        document.getElementById('my-round-entry').value = profile.roundEntry || '';
        document.getElementById('my-round-merged').value = profile.roundMerged || '';
        document.getElementById('my-round-project').value = profile.roundProject || '';
        document.getElementById('my-due-days').value = profile.dueDays ?? 30;

        // Show preview
        document.getElementById('mydetails-preview').style.display = 'block';
        const preview = document.getElementById('preview-content');
        preview.innerHTML = `
          <strong style="font-size: 18px; color: #333;">${escapeHtml(profile.businessName)}</strong><br>
          ${profile.email ? `📧 ${escapeHtml(profile.email)}<br>` : ''}
          ${profile.phone ? `📞 ${escapeHtml(profile.phone)}<br>` : ''}
          ${profile.address ? `<div style="margin-top: 8px; white-space: pre-line;">${escapeHtml(profile.address)}</div>` : ''}
          ${profile.website ? `<div style="margin-top: 8px;">🌐 ${escapeHtml(profile.website)}</div>` : ''}
          ${profile.taxId ? `<div style="margin-top: 8px;"><strong>${escapeHtml(profile.taxIdLabel || 'Tax ID')}:</strong> ${escapeHtml(profile.taxId)}</div>` : ''}
          ${profile.taxEnabled ? `<div style="margin-top: 4px;">${escapeHtml(profile.taxName || 'VAT')}: ${profile.taxRate}%</div>` : ''}
          ${profile.bankDetails ? `<div style="margin-top: 8px;"><strong>Bank Details:</strong><br><span style="white-space: pre-line;">${escapeHtml(profile.bankDetails)}</span></div>` : ''}
          ${profile.invoiceTitle ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;"><strong>Invoice Title:</strong> ${escapeHtml(profile.invoiceTitle)}</div>` : ''}
          ${profile.invoiceMessage ? `<div style="margin-top: 8px;"><strong>Invoice Message:</strong> ${escapeHtml(profile.invoiceMessage)}</div>` : ''}
        `;
      }

      // Update client profile select
      function updateClientProfileSelect() {
        const select = document.getElementById('client-profile-id');
        const currentVal = select.value;
        select.innerHTML = '<option value="">Use default profile</option>';
        profiles.forEach(p => {
          const option = document.createElement('option');
          option.value = p.id;
          const label = p.id === getDefaultProfile().id ? `${p.profileName || 'Default'} (default)` : (p.profileName || 'Unnamed Profile');
          option.textContent = label;
          select.appendChild(option);
        });
        select.value = currentVal;
      }

      // Tab switching
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = tab.dataset.tab;
          
          // Update tab buttons
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // Update tab content
          document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
          });
          document.getElementById(`${tabName}-tab`).classList.add('active');
        });
      });

      // Client form submission
      document.getElementById('client-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const client = {
          id: editingClientId || Date.now().toString(),
          name: document.getElementById('client-name').value,
          email: document.getElementById('client-email').value,
          address: document.getElementById('client-address').value,
          hourlyRate: parseFloat(document.getElementById('client-rate').value),
          profileId: document.getElementById('client-profile-id').value || ''
        };

        if (editingClientId) {
          // Update existing client
          const index = clients.findIndex(c => c.id === editingClientId);
          clients[index] = client;
          PluginAPI.showSnack({
            msg: 'Client updated successfully',
            type: 'SUCCESS'
          });
        } else {
          // Add new client
          clients.push(client);
          PluginAPI.showSnack({
            msg: 'Client added successfully',
            type: 'SUCCESS'
          });
        }

        await saveData();
        resetForm();
        renderClients();
        updateClientSelect();
        updateGenerateClientSelect();
        updateClientProfileSelect();
      });

      // Cancel edit button
      document.getElementById('cancel-edit').addEventListener('click', () => {
        resetForm();
      });

      // Reset form
      function resetForm() {
        editingClientId = null;
        document.getElementById('client-form').reset();
        document.querySelector('#client-form button[type="submit"]').textContent = 'Save Client';
        updateClientProfileSelect();
      }

      // Edit client
      function editClient(clientId) {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        editingClientId = clientId;
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-email').value = client.email || '';
        document.getElementById('client-address').value = client.address || '';
        document.getElementById('client-rate').value = client.hourlyRate;
        document.getElementById('client-profile-id').value = client.profileId || '';

        document.querySelector('#client-form button[type="submit"]').textContent = 'Update Client';
        
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Delete client
      async function deleteClient(clientId) {
        const confirmed = await PluginAPI.openDialog({
          title: 'Delete Client',
          content: 'Are you sure you want to delete this client? Project assignments will be removed.',
          okBtnLabel: 'Delete',
          cancelBtnLabel: 'Cancel'
        });

        if (confirmed) {
          clients = clients.filter(c => c.id !== clientId);
          
          // Remove project assignments
          for (const projectId in projectAssignments) {
            if (projectAssignments[projectId] === clientId) {
              delete projectAssignments[projectId];
            }
          }

          await saveData();
          renderClients();
          renderProjectAssignments();
          updateClientSelect();
          updateGenerateClientSelect();

          PluginAPI.showSnack({
            msg: 'Client deleted',
            type: 'SUCCESS'
          });
        }
      }

      // Render clients list
      function renderClients() {
        const container = document.getElementById('clients-list');
        
        if (clients.length === 0) {
          container.innerHTML = '<div class="empty-state">No clients yet. Add your first client above!</div>';
          return;
        }

        container.innerHTML = clients.map(client => {
          const assignedProjects = Object.entries(projectAssignments)
            .filter(([_, clientId]) => clientId === client.id)
            .map(([projectId, _]) => projects.find(p => p.id === projectId))
            .filter(p => p);

          const clientProfile = getClientProfile(client);
          const profileLabel = client.profileId ? ` — using "${clientProfile.profileName || 'Default'}" profile` : '';
          const taxBadge = clientProfile.taxEnabled
            ? `<span class="badge">+${clientProfile.taxRate}% ${escapeHtml(clientProfile.taxName || 'VAT')}</span>`
            : '';
          return `
            <div class="client-item">
              <div class="client-info">
                <div class="client-name">${escapeHtml(client.name)}</div>
                <div class="client-details">
                  ${client.email ? `📧 ${escapeHtml(client.email)}<br>` : ''}
                  💵 $${client.hourlyRate.toFixed(2)}/hr
                  ${taxBadge}
                  <div class="small-text">${assignedProjects.length} project(s) assigned${profileLabel}</div>
                </div>
              </div>
              <div class="client-actions">
                <button class="secondary" onclick="editClient('${client.id}')">Edit</button>
                <button class="danger" onclick="deleteClient('${client.id}')">Delete</button>
              </div>
            </div>
          `;
        }).join('');
      }

      // Update project select dropdown
      function updateProjectSelect() {
        const select = document.getElementById('project-select');
        select.innerHTML = '<option value="">-- Select a project --</option>';
        
        projects.forEach(project => {
          const option = document.createElement('option');
          option.value = project.id;
          option.textContent = project.title;
          select.appendChild(option);
        });
      }

      // Update client select dropdown
      function updateClientSelect() {
        const select = document.getElementById('client-select');
        select.innerHTML = '<option value="">-- Select a client --</option>';
        
        clients.forEach(client => {
          const option = document.createElement('option');
          option.value = client.id;
          option.textContent = client.name;
          select.appendChild(option);
        });
      }

      // Assign project to client
      document.getElementById('assign-project').addEventListener('click', async () => {
        const projectId = document.getElementById('project-select').value;
        const clientId = document.getElementById('client-select').value;

        if (!projectId || !clientId) {
          PluginAPI.showSnack({
            msg: 'Please select both a project and a client',
            type: 'WARNING'
          });
          return;
        }

        projectAssignments[projectId] = clientId;
        await saveData();
        
        document.getElementById('project-select').value = '';
        document.getElementById('client-select').value = '';

        renderProjectAssignments();
        renderClients();

        PluginAPI.showSnack({
          msg: 'Project assigned successfully',
          type: 'SUCCESS'
        });
      });

      // Remove project assignment
      async function removeAssignment(projectId) {
        delete projectAssignments[projectId];
        await saveData();
        renderProjectAssignments();
        renderClients();

        PluginAPI.showSnack({
          msg: 'Assignment removed',
          type: 'SUCCESS'
        });
      }

      // Render project assignments
      function renderProjectAssignments() {
        const container = document.getElementById('assignments-list');
        
        const assignments = Object.entries(projectAssignments)
          .map(([projectId, clientId]) => {
            const project = projects.find(p => p.id === projectId);
            const client = clients.find(c => c.id === clientId);
            return { project, client, projectId };
          })
          .filter(a => a.project && a.client);

        if (assignments.length === 0) {
          container.innerHTML = '<div class="empty-state">No project assignments yet.</div>';
          return;
        }

        container.innerHTML = assignments.map(({ project, client, projectId }) => `
          <div class="client-item">
            <div class="client-info">
              <div class="client-name">${escapeHtml(project.title)}</div>
              <div class="client-details">
                → Assigned to <strong>${escapeHtml(client.name)}</strong> ($${client.hourlyRate.toFixed(2)}/hr)
              </div>
            </div>
            <div class="client-actions">
              <button class="danger" onclick="removeAssignment('${projectId}')">Remove</button>
            </div>
          </div>
        `).join('');
      }

      // Utility: escape HTML
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      function parseDateKeyAsLocalDate(dateKey) {
        const parts = dateKey.split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) {
          return null;
        }
        const [year, month, day] = parts;
        return new Date(year, month - 1, day, 12, 0, 0, 0);
      }

      function getTaskHoursInRange(task, cutoffDate, endDate) {
        if (task.timeSpentOnDay && typeof task.timeSpentOnDay === 'object') {
          const msInRange = Object.entries(task.timeSpentOnDay).reduce((sum, [dateKey, ms]) => {
            if (typeof ms !== 'number' || ms <= 0) {
              return sum;
            }

            const localDate = parseDateKeyAsLocalDate(dateKey);
            if (!localDate) {
              return sum;
            }

            if (localDate >= cutoffDate && localDate <= endDate) {
              return sum + ms;
            }

            return sum;
          }, 0);

          return msInRange / (1000 * 60 * 60);
        }

        if (!task.parentId && task.timeSpent && task.timeSpent > 0) {
          const taskDate = new Date(task.changed || task.created);
          if (taskDate >= cutoffDate && taskDate <= endDate) {
            return task.timeSpent / (1000 * 60 * 60);
          }
        }

        return 0;
      }

      function getTopLevelTask(taskId, allTasksById) {
        let currentTask = allTasksById[taskId];
        while (currentTask && currentTask.parentId && allTasksById[currentTask.parentId]) {
          currentTask = allTasksById[currentTask.parentId];
        }
        return currentTask || null;
      }

      function normalizeTaskTitle(title) {
        return (title || '').trim().toLowerCase();
      }

      function mergeSiblingNodesByTitle(nodes) {
        const mergedByTitle = {};

        nodes.forEach(node => {
          const normalizedTitle = normalizeTaskTitle(node.title);
          const key = normalizedTitle || `__task-${node.id}`;

          if (!mergedByTitle[key]) {
            mergedByTitle[key] = {
              ...node,
              children: [...node.children]
            };
            return;
          }

          mergedByTitle[key].hours += node.hours;
          mergedByTitle[key].children.push(...node.children);
        });

        return Object.values(mergedByTitle).map(node => ({
          ...node,
          children: mergeSiblingNodesByTitle(node.children)
        }));
      }

      function renderNestedTaskNode(node, depth) {
        const paddingLeft = 20 + (depth * 18);
        const hasChildren = node.children && node.children.length > 0;
        const label = hasChildren
          ? `${escapeHtml(node.title)} (Task total: ${node.hours.toFixed(2)}h)`
          : `${escapeHtml(node.title)} (${node.hours.toFixed(2)}h)`;
        let html = `<div style="font-size: 12px; color: #666; padding: 2px 0; padding-left: ${paddingLeft}px;">• ${label}</div>`;

        node.children
          .sort((a, b) => b.hours - a.hours)
          .forEach(child => {
            html += renderNestedTaskNode(child, depth + 1);
          });

        return html;
      }

      function buildProjectTaskDetailsHtml(projectTasksForProject, allTasksById, itemizationLevel) {
        if (!projectTasksForProject || projectTasksForProject.length === 0 || itemizationLevel === 1) {
          return '';
        }

        if (itemizationLevel === 2) {
          const mainTaskBuckets = {};

          projectTasksForProject.forEach(taskEntry => {
            const topTask = getTopLevelTask(taskEntry.id, allTasksById);
            if (!topTask) {
              return;
            }

            const normalizedTitle = normalizeTaskTitle(topTask.title);
            const bucketKey = normalizedTitle || `__task-${topTask.id}`;

            if (!mainTaskBuckets[bucketKey]) {
              mainTaskBuckets[bucketKey] = {
                title: topTask.title,
                hours: 0
              };
            }

            mainTaskBuckets[bucketKey].hours += taskEntry.hours;
          });

          return Object.values(mainTaskBuckets)
            .sort((a, b) => b.hours - a.hours)
            .map(task => `<div style="font-size: 12px; color: #666; padding: 2px 0; padding-left: 20px;">• ${escapeHtml(task.title)} (${task.hours.toFixed(2)}h)</div>`)
            .join('\n');
        }

        const nodeMap = {};

        const ensureNode = (taskId) => {
          if (!taskId || nodeMap[taskId]) {
            return nodeMap[taskId] || null;
          }

          const task = allTasksById[taskId];
          if (!task) {
            return null;
          }

          nodeMap[taskId] = {
            id: task.id,
            title: task.title,
            parentId: task.parentId || null,
            hours: 0,
            children: []
          };

          return nodeMap[taskId];
        };

        projectTasksForProject.forEach(taskEntry => {
          let currentTask = allTasksById[taskEntry.id];
          while (currentTask) {
            const node = ensureNode(currentTask.id);
            if (node) {
              node.hours += taskEntry.hours;
            }
            if (!currentTask.parentId || !allTasksById[currentTask.parentId]) {
              break;
            }
            currentTask = allTasksById[currentTask.parentId];
          }
        });

        Object.values(nodeMap).forEach(node => {
          if (node.parentId && nodeMap[node.parentId]) {
            nodeMap[node.parentId].children.push(node);
          }
        });

        const rootNodes = Object.values(nodeMap)
          .filter(node => !node.parentId || !nodeMap[node.parentId])
          .sort((a, b) => b.hours - a.hours);

        const mergedRootNodes = mergeSiblingNodesByTitle(rootNodes)
          .sort((a, b) => b.hours - a.hours);

        return mergedRootNodes.map(root => renderNestedTaskNode(root, 0)).join('\n');
      }

      function buildProjectTaskDetailsHtmlFromMerged(mergedTasks, allTasksById, itemizationLevel) {
        if (!mergedTasks || mergedTasks.length === 0 || itemizationLevel === 1) {
          return '';
        }

        if (itemizationLevel === 2) {
          return mergedTasks
            .sort((a, b) => b.hours - a.hours)
            .map(task => `<div style="font-size: 12px; color: #666; padding: 2px 0; padding-left: 20px;">• ${escapeHtml(task.title)} (${task.hours.toFixed(2)}h)</div>`)
            .join('\n');
        }

        // For level 3, show all merged tasks sorted
        return mergedTasks
          .sort((a, b) => b.hours - a.hours)
          .map(task => `<div style="font-size: 12px; color: #666; padding: 2px 0; padding-left: 20px;">• ${escapeHtml(task.title)} (${task.hours.toFixed(2)}h)</div>`)
          .join('\n');
      }

      // Update generate client select
      function updateGenerateClientSelect() {
        const select = document.getElementById('gen-client-select');
        select.innerHTML = '<option value="">-- Select a client --</option>';
        
        clients.forEach(client => {
          const option = document.createElement('option');
          option.value = client.id;
          option.textContent = client.name;
          select.appendChild(option);
        });
      }

      // Handle period select change
      document.getElementById('gen-period-select').addEventListener('change', (e) => {
        const customDaysGroup = document.getElementById('gen-custom-days-group');
        const customRangeGroup = document.getElementById('gen-custom-range-group');
        
        customDaysGroup.style.display = e.target.value === 'custom-days' ? 'block' : 'none';
        customRangeGroup.style.display = e.target.value === 'custom-range' ? 'block' : 'none';
      });

      // Set today's date as default
      function setDefaultInvoiceDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('gen-invoice-date').value = today;
      }

      // Generate invoice form submission
      document.getElementById('generate-invoice-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
          const selectedClientId = document.getElementById('gen-client-select').value;
          const invoiceDate = document.getElementById('gen-invoice-date').value;
          const periodType = document.getElementById('gen-period-select').value;
          const itemizationLevel = parseInt(document.getElementById('gen-itemization-select').value);

          if (!selectedClientId) {
            PluginAPI.showSnack({
              msg: 'Please select a client',
              type: 'WARNING'
            });
            return;
          }

          const selectedClient = clients.find(c => c.id === selectedClientId);
          
          // Find projects assigned to this client
          const clientProjects = Object.entries(projectAssignments)
            .filter(([_, clientId]) => clientId === selectedClientId)
            .map(([projectId, _]) => projectId);

          if (clientProjects.length === 0) {
            PluginAPI.showSnack({
              msg: 'This client has no projects assigned',
              type: 'WARNING'
            });
            return;
          }

          // Get all tasks and projects
          const tasks = await PluginAPI.getTasks();
          const archivedTasks = await PluginAPI.getArchivedTasks();
          const allTasks = [...tasks, ...archivedTasks];
          const allTasksById = allTasks.reduce((acc, task) => {
            acc[task.id] = task;
            return acc;
          }, {});
          const parentTaskIdsWithChildren = new Set(
            allTasks
              .filter(task => !!task.parentId)
              .map(task => task.parentId)
          );

          // Calculate cutoff date
          let cutoffDate = new Date();
          let endDate = new Date();
          let periodLabel = '';

          switch (periodType) {
            case 'week': {
              const today = new Date();
              cutoffDate.setDate(today.getDate() - today.getDay());
              const weekNumber = Math.ceil((today - new Date(today.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
              periodLabel = `Week ${weekNumber}`;
              break;
            }
            case 'year': {
              const year = new Date().getFullYear();
              cutoffDate = new Date(year, 0, 1);
              periodLabel = `${year}`;
              break;
            }
            case 'last-month': {
              const today = new Date();
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                 'July', 'August', 'September', 'October', 'November', 'December'];
              const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
              const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
              cutoffDate = new Date(lastMonthYear, lastMonth, 1);
              endDate = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59);
              periodLabel = `${monthNames[lastMonth]} ${lastMonthYear}`;
              break;
            }
            case 'custom-days': {
              const daysBack = parseInt(document.getElementById('gen-custom-days').value) || 30;
              cutoffDate.setDate(cutoffDate.getDate() - daysBack);
              periodLabel = `Last ${daysBack} days`;
              break;
            }
            case 'custom-range': {
              const startDateStr = document.getElementById('gen-start-date').value;
              const endDateStr = document.getElementById('gen-end-date').value;
              
              if (!startDateStr || !endDateStr) {
                PluginAPI.showSnack({
                  msg: 'Please enter both start and end dates for custom range',
                  type: 'WARNING'
                });
                return;
              }
              
              cutoffDate = new Date(startDateStr);
              endDate = new Date(endDateStr);
              endDate.setHours(23, 59, 59);
              periodLabel = `${startDateStr} to ${endDateStr}`;
              break;
            }
            case 'month':
            default: {
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                 'July', 'August', 'September', 'October', 'November', 'December'];
              const today = new Date();
              cutoffDate = new Date(today.getFullYear(), today.getMonth(), 1);
              periodLabel = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
            }
          }

          // Calculate hours for client projects
          const projectHours = {};
          const projectTasks = {};

          const profileForClient = getClientProfile(selectedClient);
          const getRoundingConfig = () => {
            const roundMode = profileForClient.roundMode || 'round';
            const entryRound = profileForClient.roundEntry || 0;
            const mergedRound = profileForClient.roundMerged || 0;
            const projectRound = profileForClient.roundProject || 0;
            return { roundMode, entryRound, mergedRound, projectRound };
          };

          const roundToInterval = (value, intervalMinutes, roundMode) => {
            if (!intervalMinutes || intervalMinutes <= 0) return value;
            const intervalHours = intervalMinutes / 60;
            const raw = value / intervalHours;
            let result;
            if (roundMode === 'ceil') {
              result = Math.ceil(raw);
            } else if (roundMode === 'floor') {
              result = Math.floor(raw);
            } else {
              result = Math.round(raw);
            }
            return result * intervalHours;
          };

          const roundingConfig = getRoundingConfig();

          allTasks.forEach(task => {
            if (!clientProjects.includes(task.projectId)) {
              return;
            }

            if (parentTaskIdsWithChildren.has(task.id)) {
              return;
            }

            const rawHours = getTaskHoursInRange(task, cutoffDate, endDate);
            if (rawHours <= 0) {
              return;
            }

            // Apply entry rounding
            const entryRoundedHours = roundToInterval(rawHours, roundingConfig.entryRound, roundingConfig.roundMode);

            if (!projectHours[task.projectId]) {
              projectHours[task.projectId] = 0;
              projectTasks[task.projectId] = [];
            }

            projectHours[task.projectId] += entryRoundedHours;

            projectTasks[task.projectId].push({
              id: task.id,
              title: task.title,
              parentId: task.parentId || null,
              hours: entryRoundedHours
            });
          });

          if (Object.keys(projectHours).length === 0) {
            PluginAPI.showSnack({
              msg: `No time tracked for this client in the selected period`,
              type: 'WARNING'
            });
            return;
          }

          // Apply rounding config to preview function
          const dueDays = profileForClient.dueDays ?? 30;
          displayInvoicePreview(profileForClient, selectedClient, projects, projectHours, projectTasks, invoiceDate, periodLabel, itemizationLevel, allTasksById, roundingConfig, dueDays);

        } catch (error) {
          console.error('Error generating invoice:', error);
          PluginAPI.showSnack({
            msg: 'Error generating invoice: ' + error.message,
            type: 'ERROR'
          });
        }
      });

      // Display invoice preview
      async function displayInvoicePreview(profile, client, projectsList, projectHours, projectTasks, invoiceDate, periodLabel, itemizationLevel, allTasksById, roundingConfig, dueDays = 0) {
        const projectMap = {};
        projectsList.forEach(p => {
          projectMap[p.id] = p.title;
        });

        let totalHours = 0;
        let subtotal = 0;
        const invoiceNumber = generateInvoiceNumber();
        
        // Format dates for display
        const formatDateForDisplay = (dateStr) => {
          return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        };
        
        const invoiceDateFormatted = formatDateForDisplay(invoiceDate);
        
        // Calculate due date
        let dueDate = '';
        let dueDateFormatted = '';
        if (dueDays > 0) {
          const invoiceDateObj = new Date(invoiceDate);
          invoiceDateObj.setDate(invoiceDateObj.getDate() + dueDays);
          dueDate = invoiceDateObj.toISOString().split('T')[0];
          dueDateFormatted = formatDateForDisplay(dueDate);
        }
        
        const myEmailLink = profile.email ? `mailto:${profile.email}` : '';
        const clientEmailLink = client.email ? `mailto:${client.email}` : '';
        const websiteUrl = profile.website
          ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`)
          : '';

        const roundToInterval = (value, intervalMinutes, roundMode) => {
          if (!intervalMinutes || intervalMinutes <= 0) return value;
          const intervalHours = intervalMinutes / 60;
          const raw = value / intervalHours;
          let result;
          if (roundMode === 'ceil') {
            result = Math.ceil(raw);
          } else if (roundMode === 'floor') {
            result = Math.floor(raw);
          } else {
            result = Math.round(raw);
          }
          return result * intervalHours;
        };

        const lineItems = Object.entries(projectHours).map(([projectId, rawProjectHours]) => {
          const projectName = projectMap[projectId] || 'Unknown Project';

          // Get tasks for this project and merge same-named entries
          const tasksForProject = projectTasks[projectId] || [];
          const mergedTasks = {};
          
          tasksForProject.forEach(task => {
            const key = task.title.toLowerCase().trim();
            if (!mergedTasks[key]) {
              mergedTasks[key] = { title: task.title, hours: 0 };
            }
            mergedTasks[key].hours += task.hours;
          });

          // Apply merged rounding to each merged task
          const mergedWithRounding = Object.values(mergedTasks).map(task => ({
            ...task,
            hours: roundToInterval(task.hours, roundingConfig.mergedRound, roundingConfig.roundMode)
          }));

          // Sum up for project total, then apply project rounding
          const sumBeforeProjectRound = mergedWithRounding.reduce((sum, t) => sum + t.hours, 0);
          const projectTotalHours = roundToInterval(sumBeforeProjectRound, roundingConfig.projectRound, roundingConfig.roundMode);

          const amount = projectTotalHours * client.hourlyRate;
          totalHours += projectTotalHours;
          subtotal += amount;

          let descriptionContent = `<div style="font-weight: 600;">${projectName}</div>`;
          
          // Build task list with rounded merged values
          const taskList = buildProjectTaskDetailsHtmlFromMerged(mergedWithRounding, allTasksById, itemizationLevel);
          if (taskList) {
            descriptionContent += taskList;
          }

          return `
            <tr>
              <td style="padding: 12px 8px; border-bottom: 1px solid #eee;">
                ${descriptionContent}
              </td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right;">${projectTotalHours.toFixed(2)}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right;">$${client.hourlyRate.toFixed(2)}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">$${amount.toFixed(2)}</td>
            </tr>`;
        }).join('\n');

        const taxAmount = profile.taxEnabled ? (subtotal * profile.taxRate / 100) : 0;
        const total = subtotal + taxAmount;

        const invoiceHTML = `
__INVOICE_TEMPLATE__
`;

        // Show preview
        document.getElementById('invoice-preview').style.display = 'block';
        const container = document.getElementById('invoice-iframe-container');
        
        const invoiceData = {
          number: invoiceNumber,
          clientId: client.id,
          clientName: client.name,
          date: invoiceDate,
          dueDate: dueDate,
          period: periodLabel,
          total: total,
          createdAt: new Date().toISOString()
        };
        pendingInvoiceData = invoiceData;
        hasPendingInvoiceSaved = false;
        
        // Create iframe with the invoice
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '800px';
        iframe.style.border = '1px solid #ddd';
        iframe.style.borderRadius = '4px';
        container.innerHTML = '';
        container.appendChild(iframe);
        
        iframe.onload = () => {
          iframe.contentDocument.write(invoiceHTML);
          iframe.contentDocument.close();

          if (iframe.contentWindow) {
            iframe.contentWindow.addEventListener('beforeprint', () => {
              finalizeInvoiceSave();
            });
          }
        };
        
        iframe.src = 'about:blank';

        PluginAPI.showSnack({
          msg: `Preview ready. Invoice #${invoiceNumber} will be saved when you print or save to PDF.`,
          type: 'SUCCESS'
        });
      }

      // Wait for PluginAPI to be ready
      function waitForPluginAPI() {
        return new Promise((resolve) => {
          if (typeof PluginAPI !== 'undefined') {
            resolve();
          } else {
            const checkInterval = setInterval(() => {
              if (typeof PluginAPI !== 'undefined') {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          }
        });
      }

      // Initialize on load
      waitForPluginAPI().then(() => {
        init();
      });
