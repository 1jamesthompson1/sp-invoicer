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
      let myDetails = null;
      let clients = [];
      let projectAssignments = {};
      let projects = [];
      let editingClientId = null;
      let generatedInvoices = []; // Store generated invoices with their numbers
      let lastPersistAt = 0;
      let pendingInvoiceData = null;
      let hasPendingInvoiceSaved = false;

      // Initialize
      async function init() {
        await loadData();
        await loadProjects();
        
        // Set default values if needed
        if (!myDetails) {
          myDetails = {};
        }
        if (!myDetails.invoiceTitle) {
          myDetails.invoiceTitle = 'Invoice';
        }
        if (!myDetails.invoiceMessage) {
          myDetails.invoiceMessage = 'Thank you for your business!';
        }
        if (!myDetails.taxIdLabel) {
          myDetails.taxIdLabel = 'Tax ID';
        }
        
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
            taxEnabled: true
          }];
          await saveData();
        }
        
        renderMyDetails();
        renderClients();
        renderProjectAssignments();
        updateProjectSelect();
        updateClientSelect();
        updateGenerateClientSelect();
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
            myDetails = parsed.myDetails || null;
            clients = parsed.clients || [];
            projectAssignments = parsed.projectAssignments || {};
            generatedInvoices = parsed.generatedInvoices || [];
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
            myDetails: myDetails,
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

      // My Details form submission
      document.getElementById('mydetails-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        myDetails = {
          name: document.getElementById('my-name').value,
          email: document.getElementById('my-email').value,
          phone: document.getElementById('my-phone').value,
          address: document.getElementById('my-address').value,
          website: document.getElementById('my-website').value,
          taxIdLabel: document.getElementById('my-tax-id-label').value || 'Tax ID',
          taxId: document.getElementById('my-tax-id').value,
          bankDetails: document.getElementById('my-bank').value,
          invoiceTitle: document.getElementById('my-invoice-title').value || 'Invoice',
          invoiceMessage: document.getElementById('my-invoice-message').value || 'Thank you for your business!'
        };

        await saveData();
        renderMyDetails();

        PluginAPI.showSnack({
          msg: 'Your details saved successfully',
          type: 'SUCCESS'
        });
      });

      // Render my details
      function renderMyDetails() {
        if (myDetails && myDetails.name) {
          // Populate form
          document.getElementById('my-name').value = myDetails.name || '';
          document.getElementById('my-email').value = myDetails.email || '';
          document.getElementById('my-phone').value = myDetails.phone || '';
          document.getElementById('my-address').value = myDetails.address || '';
          document.getElementById('my-website').value = myDetails.website || '';
          document.getElementById('my-tax-id-label').value = myDetails.taxIdLabel || 'Tax ID';
          document.getElementById('my-tax-id').value = myDetails.taxId || '';
          document.getElementById('my-bank').value = myDetails.bankDetails || '';
          document.getElementById('my-invoice-title').value = myDetails.invoiceTitle || 'Invoice';
          document.getElementById('my-invoice-message').value = myDetails.invoiceMessage || 'Thank you for your business!';

          // Show preview
          document.getElementById('mydetails-preview').style.display = 'block';
          const preview = document.getElementById('preview-content');
          preview.innerHTML = `
            <strong style="font-size: 18px; color: #333;">${escapeHtml(myDetails.name)}</strong><br>
            ${myDetails.email ? `📧 ${escapeHtml(myDetails.email)}<br>` : ''}
            ${myDetails.phone ? `📞 ${escapeHtml(myDetails.phone)}<br>` : ''}
            ${myDetails.address ? `<div style="margin-top: 8px; white-space: pre-line;">${escapeHtml(myDetails.address)}</div>` : ''}
            ${myDetails.website ? `<div style="margin-top: 8px;">🌐 ${escapeHtml(myDetails.website)}</div>` : ''}
            ${myDetails.taxId ? `<div style="margin-top: 8px;"><strong>${escapeHtml(myDetails.taxIdLabel || 'Tax ID')}:</strong> ${escapeHtml(myDetails.taxId)}</div>` : ''}
            ${myDetails.bankDetails ? `<div style="margin-top: 8px;"><strong>Bank Details:</strong><br><span style="white-space: pre-line;">${escapeHtml(myDetails.bankDetails)}</span></div>` : ''}
            ${myDetails.invoiceTitle ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;"><strong>Invoice Title:</strong> ${escapeHtml(myDetails.invoiceTitle)}</div>` : ''}
            ${myDetails.invoiceMessage ? `<div style="margin-top: 8px;"><strong>Invoice Message:</strong> ${escapeHtml(myDetails.invoiceMessage)}</div>` : ''}
          `;
        }
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
          taxName: document.getElementById('client-tax-name').value || 'Tax',
          taxRate: parseFloat(document.getElementById('client-tax-rate').value) || 0,
          taxEnabled: document.getElementById('client-tax-enabled').checked
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
        document.getElementById('client-tax-name').value = client.taxName || '';
        document.getElementById('client-tax-rate').value = client.taxRate || 0;
        document.getElementById('client-tax-enabled').checked = client.taxEnabled;

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

          return `
            <div class="client-item">
              <div class="client-info">
                <div class="client-name">${escapeHtml(client.name)}</div>
                <div class="client-details">
                  ${client.email ? `📧 ${escapeHtml(client.email)}<br>` : ''}
                  💵 $${client.hourlyRate.toFixed(2)}/hr
                  ${client.taxEnabled ? `<span class="badge">+${client.taxRate}% ${escapeHtml(client.taxName)}</span>` : ''}
                  <div class="small-text">${assignedProjects.length} project(s) assigned</div>
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

          allTasks.forEach(task => {
            if (!clientProjects.includes(task.projectId)) {
              return;
            }

            if (parentTaskIdsWithChildren.has(task.id)) {
              return;
            }

            const hours = getTaskHoursInRange(task, cutoffDate, endDate);
            if (hours <= 0) {
              return;
            }

            if (!projectHours[task.projectId]) {
              projectHours[task.projectId] = 0;
              projectTasks[task.projectId] = [];
            }

            projectHours[task.projectId] += hours;

            projectTasks[task.projectId].push({
              id: task.id,
              title: task.title,
              parentId: task.parentId || null,
              hours: hours
            });
          });

          if (Object.keys(projectHours).length === 0) {
            PluginAPI.showSnack({
              msg: `No time tracked for this client in the selected period`,
              type: 'WARNING'
            });
            return;
          }

          // Generate invoice HTML using the plugin's function
          // For now, we'll create a simple preview
          displayInvoicePreview(myDetails, selectedClient, projects, projectHours, projectTasks, invoiceDate, periodLabel, itemizationLevel, allTasksById);

        } catch (error) {
          console.error('Error generating invoice:', error);
          PluginAPI.showSnack({
            msg: 'Error generating invoice: ' + error.message,
            type: 'ERROR'
          });
        }
      });

      // Display invoice preview
      async function displayInvoicePreview(myDetails, client, projectsList, projectHours, projectTasks, invoiceDate, periodLabel, itemizationLevel, allTasksById) {
        const projectMap = {};
        projectsList.forEach(p => {
          projectMap[p.id] = p.title;
        });

        let totalHours = 0;
        let subtotal = 0;
        // Generate unique invoice number
        const invoiceNumber = generateInvoiceNumber();
        const myEmailLink = myDetails.email ? `mailto:${myDetails.email}` : '';
        const clientEmailLink = client.email ? `mailto:${client.email}` : '';
        const websiteUrl = myDetails.website
          ? (myDetails.website.startsWith('http') ? myDetails.website : `https://${myDetails.website}`)
          : '';

        const lineItems = Object.entries(projectHours).map(([projectId, hours]) => {
          const projectName = projectMap[projectId] || 'Unknown Project';
          const amount = hours * client.hourlyRate;
          totalHours += hours;
          subtotal += amount;

          let descriptionContent = `<div style="font-weight: 600;">${projectName}</div>`;
          
          const taskList = buildProjectTaskDetailsHtml(projectTasks[projectId], allTasksById, itemizationLevel);
          if (taskList) {
            descriptionContent += taskList;
          }

          return `
            <tr>
              <td style="padding: 12px 8px; border-bottom: 1px solid #eee;">
                ${descriptionContent}
              </td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right;">${hours.toFixed(2)}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right;">$${client.hourlyRate.toFixed(2)}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">$${amount.toFixed(2)}</td>
            </tr>`;
        }).join('\n');

        const taxAmount = client.taxEnabled ? (subtotal * client.taxRate / 100) : 0;
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
