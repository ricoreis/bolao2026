import { supabaseClient } from './supabase-config.js';
import { carregarSaudacao } from './auth-header.js';

// Variável global para armazenar as regras do banco
let configRegras = [];

const DB_CONFIG = {
    JOGOS: 'jogos',
};

// const btnLogout = document.getElementById('btn-logout');
const btnsLogout = document.querySelectorAll('.btn-logout');
const toast = document.getElementById('toast');

// Carrega as regras do banco ao iniciar o bolão
async function carregarRegras() {
    const { data } = await supabaseClient.from('pontuacao').select('*');
    if (data) configRegras = data;
}

function toggleSalvar(inputA, inputB, btnSalvar, containerPenaltis = null) {
    const originalA = inputA.dataset.valorOriginal;
    const originalB = inputB.dataset.valorOriginal;
    const atualA = inputA.value;
    const atualB = inputB.value;
    
    // 1. Verifica se os campos estão preenchidos (evita salvar campos em branco)
    const estaPreenchido = (atualA !== "" && atualB !== "");
    
    // 2. Verifica se houve mudança em relação ao original
    let houveMudancaGols = (originalA !== atualA || originalB !== atualB);
    
    // 3. Regra de Pênaltis (Mata-mata)
    let estaProntoParaSalvar = true;
    if (containerPenaltis && atualA === atualB && estaPreenchido) {
        const radioChecked = containerPenaltis.querySelector('input[type="radio"]:checked');
        if (!radioChecked) {
            estaProntoParaSalvar = false; // Empatou mas não escolheu vencedor
        }
    }

    // 4. Verifica mudança nos rádios
    let houveMudancaRadio = false;
    if (containerPenaltis) {
        const radioChecked = containerPenaltis.querySelector('input[type="radio"]:checked');
        const valorAtualRadio = radioChecked ? radioChecked.value : null;
        const valorOriginalRadio = containerPenaltis.dataset.valorOriginal || null;
        houveMudancaRadio = (valorAtualRadio !== valorOriginalRadio);
    }

    // BOTÃO SÓ APARECE SE:
    // - Estiver preenchido E (Houve mudança nos gols OU nos rádios) E estiver pronto (definiu pênaltis se for empate)
    if (estaPreenchido && (houveMudancaGols || houveMudancaRadio) && estaProntoParaSalvar) {
        btnSalvar.classList.remove('hidden');
    } else {
        btnSalvar.classList.add('hidden');
    }
}

function showToast(mensagem) {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    // Adicione a classe 'pointer-events-auto' para poder clicar no toast se necessário
    toast.className = `px-6 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 text-white transition-all duration-300 transform opacity-0 translate-y-5 pointer-events-auto`;
    toast.textContent = mensagem;

    container.appendChild(toast);

    // Trigger da animação
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-5');
        toast.classList.add('opacity-100', 'translate-y-0');
    });

    // Remove após 3s
    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-5');
        // Remove do DOM após a animação de saída terminar
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function verificarSessao() {
    await carregarRegras(); 
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    
    const { data: userData } = await supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single();
    carregarJogosEApostas();
}

async function carregarJogosEApostas() {
    // 1. Obtém as referências dos elementos
    const loader = document.getElementById('loader');
    const jogosContainer = document.getElementById('jogos-container'); // Ajuste o ID conforme o seu HTML

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;

        const ehPaginaFinais = window.location.pathname.includes('apostas-finais.html');

        let query = supabaseClient
            .from(DB_CONFIG.JOGOS)
            .select(`
                *,
                fase:fases(nome),
                time_a:paises!jogos_time_a_id_fkey(nome, sigla, id),
                time_b:paises!jogos_time_b_id_fkey(nome, sigla, id)
            `);

        if (ehPaginaFinais) {
            query = query.gt('fase_id', 1).order('fase_id', { ascending: true }).order('data_jogo', { ascending: true });
        } else {
            query = query.eq('fase_id', 1).order('data_jogo', { ascending: true });
        }

        const tempoMinimo = new Promise(resolve => setTimeout(resolve, 3000));

        // Usando Promise.all para carregar tudo de uma vez, igual ao ranking
        const [ {data: jogos, error: erroJogos}, {data: apostas} ] = await Promise.all([
            query,
            supabaseClient.from('apostas').select('*').eq('usuario_id', session.user.id),
            tempoMinimo
        ]);

        if (erroJogos) throw erroJogos;

        const mapaApostas = {};
        if (apostas) apostas.forEach(p => mapaApostas[p.jogo_id] = p);

        // 2. Renderiza
        renderizarJogos(jogos, mapaApostas, ehPaginaFinais);
        popularChaveamento(jogos, ehPaginaFinais);
        
        // 3. Sucesso: esconde o loader e mostra o conteúdo
        if (loader) loader.classList.add('hidden');
        if (jogosContainer) jogosContainer.classList.remove('hidden');

        setTimeout(rolarParaUltimoResultado, 500);

    } catch (error) {
        console.error("Erro ao carregar jogos:", error);
        
        // 4. Erro: mostra o feedback visual
        if (loader) {
            loader.innerHTML = `
                <div class="text-center p-6">
                    <iconify-icon class="text-5xl text-red-500" icon="material-symbols:error-outline"></iconify-icon>
                    <p class="text-red-400 mt-4">Erro ao carregar jogos.</p>
                    <button onclick="window.location.reload()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Tentar novamente</button>
                </div>
            `;
        }
    }
}

function renderizarJogos(jogos, mapaApostas, ehPaginaFinais) {
    const container = document.getElementById('container-jogos');
    const template = document.getElementById('template-jogo');
    if (!container || !template) return;
    container.innerHTML = ''; 

    let faseAtualRegistrada = "";

    jogos.forEach(jogo => {
        const aposta = mapaApostas ? mapaApostas[jogo.id] : null;
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.card-jogo');

        cardElement.dataset.dataJogo = jogo.data_jogo;
        cardElement.dataset.jogoId = jogo.id;

        const dataLocal = new Date(jogo.data_jogo);
        const agora = new Date();
        const faltamMenosDeUmaHora = (dataLocal - agora) / (1000 * 60) < 60;
        const jogoOcorrido = (jogo.gols_a !== null && jogo.gols_b !== null);

        if (ehPaginaFinais && jogo.fase?.nome !== faseAtualRegistrada) {
            faseAtualRegistrada = jogo.fase?.nome;
            const header = document.createElement('h3');
            header.className = "text-sm font-bold uppercase tracking-wider text-emerald-400 bg-gray-800/30 border border-gray-700/40 px-4 py-2.5 rounded-lg flex items-center justify-center text-lg h-24 mt-6 mb-3 w-full";
            header.innerText = faseAtualRegistrada || "Mata-Mata";
            container.appendChild(header);
        }

        let jogoPrefixo = "";
        if(jogo.jogo_fifa) {
            jogoPrefixo = "JOGO " + jogo.jogo_fifa + " - "
        }

        const ehUltimoComResultado = jogoOcorrido && (jogos.filter(j => j.gols_a !== null && j.gols_b !== null).pop() === jogo);
        if (ehUltimoComResultado) {
            cardElement.id = "ultimo-placar-oficial";
        }

        card.querySelector('.fase').innerText = jogo.jogo_fifa ? jogo.fase?.nome : "Grupo " + jogo.grupo;
        card.querySelector('.data-jogo').innerText = jogoPrefixo + dataLocal.toLocaleString('pt-BR', {
            weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }).replace(' ', '').replace(',', ' ').replace(', ', ' ').toUpperCase();

        card.querySelector('.time-a').innerText = jogo.time_a?.nome || jogo.time_a_placeholder || 'A definir';
        card.querySelector('.time-b').innerText = jogo.time_b?.nome || jogo.time_b_placeholder || 'A definir';
        card.querySelector('.sigla-a').innerText = jogo.time_a?.sigla || jogo.time_a_placeholder || 'A definir';
        card.querySelector('.sigla-b').innerText = jogo.time_b?.sigla || jogo.time_b_placeholder || 'A definir';

        configurarBandeira(card, '.band-a', jogo.time_a);
        configurarBandeira(card, '.band-b', jogo.time_b);

        const inputA = card.querySelector('.input-a');
        const inputB = card.querySelector('.input-b');
        const definitivoA = card.querySelector('.definitivo-a');
        const definitivoB = card.querySelector('.definitivo-b');
        const btnSalvar = card.querySelector('.btn-salvar');
        const statusBadge = card.querySelector('.status-badge');
        const btnVerApostas = card.querySelector('.ver-apostas');
        const confrontoDefinido = jogo.time_a && jogo.time_b;

        inputA.id = `golsA_${jogo.id}`;
        inputB.id = `golsB_${jogo.id}`;
        inputA.value = aposta?.gols_a ?? '';
        inputB.value = aposta?.gols_b ?? '';

        definitivoA.textContent = inputA.value;
        definitivoB.textContent = inputB.value;

        inputA.dataset.valorOriginal = String(aposta?.gols_a ?? '');
        inputB.dataset.valorOriginal = String(aposta?.gols_b ?? '');

        const listener = () => toggleSalvar(inputA, inputB, btnSalvar, containerPenaltis);
        inputA.addEventListener('input', listener);
        inputB.addEventListener('input', listener);

        // NOVO: Listener para os rádios (com proteção)
        const radioA = card.querySelector('.radio-penaltis-a');
        const radioB = card.querySelector('.radio-penaltis-b');

        // SÓ adiciona o listener se os rádios existirem no card
        if (radioA && radioB) {
            [radioA, radioB].forEach(r => {
                r.addEventListener('change', listener);
            });
        }

        toggleSalvar(inputA, inputB, btnSalvar);

        // Cálculo dinâmico com Multiplicador
        if (jogo.gols_a !== null && jogo.gols_b !== null && aposta) {
            // Se fase_id > 1 (Mata-mata), multiplicador é 2, senão é 1
            const multiplicador = (jogo.fase_id > 1) ? 2 : 1;
            
            const resultado = calcularPontosRegulares(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, configRegras, multiplicador);
            const pontos = resultado.total; // Pega apenas o número para exibir            
            
            // LOGICA NOVA DE CORES:
            // pontos > 0: verde/âmbar (ganhou)
            // pontos === 0: cinza (neutro)
            // pontos < 0: vermelho (perdeu - se existir essa regra)
            let corPontos = "bg-gray-700 text-gray-400"; // Cor para ZERO
            if (pontos > 0) corPontos = "bg-amber-400 text-gray-800 font-bold";
            if (pontos < 0) corPontos = "bg-red-400 text-gray-800 font-bold";

            const divInfo = document.createElement('div');
            divInfo.className = "p-2 bg-gray-900/50 rounded-full text-center text-xs flex flex-row gap-2 items-center justify-center mt-1.5";
            divInfo.innerHTML = `
                <div class="text-gray-400">Placar Final: ${jogo.gols_a} x ${jogo.gols_b}</div>
                <div class="text-sm rounded-full px-2 py-1 w-fit ${corPontos}">
                    ${pontos == 0 ? "-" : pontos > 0 ? "+" + pontos : pontos} ${multiplicador > 1 ? "<span class='text-xs'>dobrado!</span>" : "" }
                </div>
            `;
            cardElement.appendChild(divInfo);
        }

        const estaBloqueado = jogoOcorrido || faltamMenosDeUmaHora || !confrontoDefinido;

        if (estaBloqueado) {
            // DESABILITA TUDO
            inputA.disabled = true; 
            inputB.disabled = true; 
            btnSalvar.disabled = true;
            btnSalvar.classList.add("hidden");

            if (jogoOcorrido) {
                // Estado 1: Jogo Ocorrido
                inputA.classList.add("hidden"); 
                inputB.classList.add("hidden");
                definitivoA.classList.remove("hidden"); 
                definitivoB.classList.remove("hidden");
                statusBadge.classList.add("hidden");
                btnVerApostas.classList.remove("hidden");
                btnVerApostas.onclick = () => abrirModal(jogo.id, jogo.time_a.nome, jogo.time_b.nome);
            } 
            else if (faltamMenosDeUmaHora) {
                // Estado 2: Apostas Encerradas (menos de 1h ou início)
                inputA.classList.add("opacity-50", "cursor-not-allowed", "hidden");
                inputB.classList.add("opacity-50", "cursor-not-allowed", "hidden");
                definitivoA.classList.remove("hidden"); 
                definitivoB.classList.remove("hidden");
                
                statusBadge.classList.remove("hidden");
                if (confrontoDefinido) {
                    statusBadge.innerText = "Apostas Encerradas! Aguardando resultado";
                    btnVerApostas.classList.remove("hidden");
                    btnVerApostas.onclick = () => abrirModal(jogo.id, jogo.time_a.nome, jogo.time_b.nome);
                } else {
                    statusBadge.innerText = "Aguardando definição de chaves";
                    btnVerApostas.classList.add("hidden");
                }
            }
            else if (!confrontoDefinido) {
                if (jogo.fase_id > 1) {
                    statusBadge.classList.remove("hidden");
                    inputA.classList.add("hidden");
                    inputB.classList.add("hidden");
                } else {
                    statusBadge.classList.add("hidden");
                }
                inputA.classList.add("opacity-0", "cursor-auto");
                inputB.classList.add("opacity-0", "cursor-auto");
            }

            const containerPenaltis = card.querySelector('.container-penaltis');
            const valorA = parseInt(inputA.value);
            const valorB = parseInt(inputB.value);

            if (containerPenaltis && valorA === valorB && !isNaN(valorA)) {
                const pai = containerPenaltis.parentNode;
                
                // Verifica marcação de renderização
                if (pai.dataset.renderizado === 'true') return;

                const radioMarcado = containerPenaltis.querySelector('input[type="radio"]:checked');

                const penaltiVencedorId = jogo.penaltis_vencedor_id;
                const apostaVencedorId = aposta.penaltis_vencedor_id;
                
                if (apostaVencedorId) {

                    let nomeTime = "";
                    if (apostaVencedorId == jogo.time_a.id) {
                        nomeTime = jogo.time_a.nome;
                    } else if (apostaVencedorId == jogo.time_b.id) {
                        nomeTime = jogo.time_b.nome;
                    }

                    containerPenaltis.classList.add('hidden');
                    
                    if(faltamMenosDeUmaHora && !jogoOcorrido) {
                        const divConfirmacao = document.createElement('div');
                        divConfirmacao.className = "texto-aposta-final text-gray-400 text-center text-xs";
                        divConfirmacao.innerHTML = `Aposta nos pênaltis: <span class="text-white">${nomeTime}</span>`;
                        pai.appendChild(divConfirmacao);
                    }
                    pai.dataset.renderizado = 'true';
                }

            } else if (containerPenaltis && (valorA !== valorB)) {
                // Se não é empate, garantimos que o container de pênaltis fique escondido
                containerPenaltis.classList.add('hidden');
            }
            
        } 
        else {
            // ESTADO: PODE EDITAR
            statusBadge.classList.add("hidden");
            btnSalvar.onclick = (e) => salvarAposta(jogo.id, cardElement, ehPaginaFinais);
        }

        // --- Lógica de Pênaltis ---
        const containerPenaltis = card.querySelector('.container-penaltis');
        if (containerPenaltis && ehPaginaFinais && jogo.fase_id > 1) {
            const radioA = card.querySelector('.radio-penaltis-a');
            const radioB = card.querySelector('.radio-penaltis-b');

            // Atribui o ID REAL vindo do banco
            radioA.value = jogo.time_a_id; 
            radioB.value = jogo.time_b_id;

            // Importante: garante que o nome do grupo seja único para esse jogo específico
            // Senão, ao clicar em um jogo, você desmarca o radio de todos os outros
            const nomeGrupo = `penaltis_${jogo.id}`;
            radioA.name = nomeGrupo;
            radioB.name = nomeGrupo;

            // Adicione isso logo após configurar o radio (radioA/radioB):
            if (aposta && aposta.penaltis_vencedor_id) {
                // Guarda o valor que veio do banco no radio button
                if (parseInt(radioA.value) === aposta.penaltis_vencedor_id) radioA.checked = true;
                if (parseInt(radioB.value) === aposta.penaltis_vencedor_id) radioB.checked = true;
                
                // MARCA O VALOR ORIGINAL NO CONTAINER
                containerPenaltis.dataset.valorOriginal = String(aposta.penaltis_vencedor_id);
            }

            // Se o jogo já ocorreu (tem resultado oficial)
            if (jogo.gols_a !== null && jogo.gols_b !== null) {
                // Esconde os inputs de aposta
                containerPenaltis.classList.add('hidden');
                
                const divResultado = document.createElement('div');
                divResultado.className = "mt-2 p-2 bg-gray-800 rounded text-center text-xs";

                let mensagemHTML = "";

                if (jogo.penaltis_vencedor_id) {
                    const timeVencedor = (jogo.penaltis_vencedor_id === jogo.time_a_id) ? jogo.time_a.nome : jogo.time_b.nome;
                    const acertou = aposta?.penaltis_vencedor_id === jogo.penaltis_vencedor_id;
                    
                    const resultadoPenaltis = calcularPontosPenaltis(aposta.penaltis_vencedor_id, jogo.penaltis_vencedor_id, configRegras);
                    const pontosPenaltis = resultadoPenaltis.pontos;

                    const corPenaltis = "bg-amber-400 text-gray-800 font-bold";

                    mensagemHTML = acertou 
                        ? `<div class="flex gap-2 w-full justify-center items-center">
                            <span class="text-gray-400 text-xs">Você acertou ${timeVencedor} vencendo nos pênaltis!</span>
                            <div class="text-sm rounded-full px-2 py-1 w-fit ${corPenaltis}">+${pontosPenaltis}</div>
                        </div>`
                        : `<span class="text-red-400 text-xs">Você não acertou o vencedor dos pênaltis.</span>`;
                } else if (aposta?.penaltis_vencedor_id) {
                    mensagemHTML = `<span class="text-gray-600 text-xs">Jogo não foi para pênaltis.</span>`;
                }

                if (mensagemHTML !== "") {
                    const divResultado = document.createElement('div');
                    divResultado.className = "mt-2 p-2 rounded text-center text-xs";
                    divResultado.innerHTML = mensagemHTML;
                    cardElement.appendChild(divResultado);
                }

            } else {
                card.querySelector('.nome-time-a').innerText = jogo.time_a?.nome || 'Time A';
                card.querySelector('.nome-time-b').innerText = jogo.time_b?.nome || 'Time B';

                const checkEmpate = () => {
                    const vA = parseInt(inputA.value);
                    const vB = parseInt(inputB.value);
                    if (!isNaN(vA) && !isNaN(vB) && vA === vB && !estaBloqueado) {
                        containerPenaltis.classList.remove('hidden');
                    } else {
                        containerPenaltis.classList.add('hidden');
                    }
                };
                inputA.addEventListener('input', checkEmpate);
                inputB.addEventListener('input', checkEmpate);
                checkEmpate();
            }
        }

        container.appendChild(card);
    });
}

async function salvarAposta(jogoId, cardElement, ehPaginaFinais) {
    const { data: jogo } = await supabaseClient
        .from(DB_CONFIG.JOGOS)
        .select('data_jogo, gols_a, gols_b')
        .eq('id', jogoId)
        .single();

    const dataJogo = new Date(jogo.data_jogo).getTime();
    const agora = Date.now();
    const margemSeguranca = 60 * 60 * 1000; // 60 minutos * 60 segundos * 1000ms

    // DEBUG CORRIGIDO
    console.log("Horário Local (Agora):", new Date(agora).toLocaleString());
    console.log("Horário Jogo (Banco):", new Date(dataJogo).toLocaleString());
    console.log("Diferença (segundos):", (dataJogo - agora) / 1000);
    // -----------------------

    if (agora + margemSeguranca >= dataJogo) {
        console.log("agora + margemSeguranca >= dataJogo");
        congelarCard(cardElement, "Apostas Encerradas! Aguardando resultado");
        abrirModalMensagem("Atenção", "As apostas deste jogo estão encerradas.<br>Não dê mole nas próximas!");
        return;
    }
    console.log("NAO!!! agora + margemSeguranca >= dataJogo");

    const inputA = cardElement.querySelector('.input-a');
    const inputB = cardElement.querySelector('.input-b');
    const btnSalvar = cardElement.querySelector('.btn-salvar');

    // 1. Capture os nomes dos times e valores aqui
    const nomeTimeA = cardElement.querySelector('.time-a').innerText;
    const nomeTimeB = cardElement.querySelector('.time-b').innerText;
    const placarA = inputA.value;
    const placarB = inputB.value;
    const ehEmpate = (placarA === placarB);

    // 1. Estado de "Salvando" (seu estilo)
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `<span class="opacity-70">Salvando...</span>`;
    inputA.disabled = true;
    inputB.disabled = true;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const dadosAposta = { 
            usuario_id: user.id, 
            jogo_id: jogoId, 
            gols_a: parseInt(inputA.value), 
            gols_b: parseInt(inputB.value) 
        };

        if (ehPaginaFinais) {
            if (ehEmpate) {
                const radio = cardElement.querySelector(`input[name="penaltis_${jogoId}"]:checked`);
                dadosAposta.penaltis_vencedor_id = radio ? parseInt(radio.value) : null;
            } else {
                dadosAposta.penaltis_vencedor_id = null;
            }
        }

        const { error } = await supabaseClient.from('apostas').upsert(dadosAposta, { onConflict: 'usuario_id, jogo_id' });
        
        if (error) throw error;

        btnSalvar.innerHTML = `<span class="text-emerald-400 font-bold">Aposta salva!</span>`;
        btnSalvar.classList.add('bg-emerald-900/20', 'border-emerald-700');
        btnSalvar.classList.remove('hover:bg-emerald-700');

        // showToast("Aposta salva!");
        showToast(`Aposta salva: ${nomeTimeA} ${placarA} x ${placarB} ${nomeTimeB}`);

        inputA.dataset.valorOriginal = String(inputA.value);
        inputB.dataset.valorOriginal = String(inputB.value);
        
        if (ehPaginaFinais) {
            // const radio = cardElement.querySelector(`input[name="penaltis_${jogoId}"]:checked`);
            const containerPenaltis = cardElement.querySelector('.container-penaltis');
            if (placarA !== placarB) {
                const radios = containerPenaltis.querySelectorAll('input[type="radio"]');
                radios.forEach(r => r.checked = false);
                containerPenaltis.dataset.valorOriginal = null;
            } else {
                // Se for empate, atualiza o valor original para o radio que foi clicado
                const radio = containerPenaltis.querySelector('input[type="radio"]:checked');
                containerPenaltis.dataset.valorOriginal = radio ? radio.value : null;
            }
        }

        setTimeout(() => {
            btnSalvar.innerHTML = textoOriginal;
            btnSalvar.classList.remove('bg-emerald-900/20', 'border-emerald-700');
            btnSalvar.classList.add('hover:bg-emerald-700');
            
            inputA.disabled = false;
            inputB.disabled = false;
            btnSalvar.disabled = false;

            toggleSalvar(inputA, inputB, btnSalvar);
        }, 3000);

    } catch (e) { 
        console.error(e);
        showToast("Erro ao processar.", true);
        
        // Restaura em caso de erro
        btnSalvar.innerHTML = textoOriginal;
        inputA.disabled = false;
        inputB.disabled = false;
        btnSalvar.disabled = false;
    }
}

async function abrirModal(jogoId, nomeA, nomeB) {
    const lista = document.getElementById('lista-apostas-modal');
    const tituloModal = document.querySelector('#modal-apostas h3');
    const containerMeuPalpite = document.getElementById('meu-palpite-container');
    const valorMeuPalpite = document.getElementById('meu-palpite-valor');

    tituloModal.innerText = `${nomeA} x ${nomeB}`;
    
    if (containerMeuPalpite) containerMeuPalpite.classList.add('hidden');
    lista.innerHTML = '<tr><td class="p-4 text-center text-gray-400">Carregando...</td></tr>';
    document.body.classList.add('modal-aberto');
    document.getElementById('modal-apostas').classList.remove('hidden');
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: apostas } = await supabaseClient
        .from('apostas')
        .select('gols_a, gols_b, usuarios(nome, id)')
        .eq('jogo_id', jogoId);

    const minhaAposta = apostas?.find(a => a.usuarios?.id === user?.id);
    if (minhaAposta && containerMeuPalpite) {
        valorMeuPalpite.innerText = `${minhaAposta.gols_a} x ${minhaAposta.gols_b}`;
        containerMeuPalpite.classList.remove('hidden');
    }

    const outrasApostas = apostas?.filter(a => a.usuarios?.id !== user?.id) || [];

    if (!apostas || apostas.length === 0) {
        lista.innerHTML = '<tr><td class="p-4 text-center text-gray-400">Ninguém apostou neste jogo.</td></tr>';
        return;
    }

    const grupos = { vitoriaA: [], vitoriaB: [], empate: [] };

    outrasApostas.forEach(a => {
        if (a.gols_a > a.gols_b) grupos.vitoriaA.push(a);
        else if (a.gols_b > a.gols_a) grupos.vitoriaB.push(a);
        else grupos.empate.push(a);
    });

    const ctx = document.getElementById('meuGraficoDonut').getContext('2d');
    if (window.meuGrafico instanceof Chart) window.meuGrafico.destroy();
    window.meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [grupos.vitoriaA.length, grupos.empate.length, grupos.vitoriaB.length],
                backgroundColor: ['#10B981', '#4B5563', '#D1FAE5'],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });
    document.getElementById('legenda-A').innerText = nomeA;
    document.getElementById('legenda-B').innerText = nomeB;

    const ordenar = (a, b) => (a.gols_a - b.gols_a) || (a.gols_b - b.gols_b);
    grupos.vitoriaA.sort(ordenar);
    grupos.vitoriaB.sort(ordenar);
    grupos.empate.sort(ordenar);

    // 4. Função auxiliar de renderização
    const gerarSecao = (titulo, listaApostas) => {
        if (listaApostas.length === 0) return '';
        return `
            <tr><td colspan="2" class="bg-gray-800 text-emerald-500 font-bold text-sm uppercase">
                <span class="bg-black/20 w-full flex rounded-lg px-4 py-4 mb-6">
                    ${titulo}
                </span>
            </td></tr>
            ${listaApostas.map(a => `
                <tr class="border-b border-gray-700/50">
                    <td class="py-3 text-gray-200">${a.usuarios?.nome || 'Anon'}</td>
                    <td class="py-3 text-center text-emerald-400 font-bold">${a.gols_a} x ${a.gols_b}</td>
                </tr>
            `).join('')}
            <tr><td colspan="2" class="h-16"></td></tr>
        `;
    };

    // 5. Renderiza na tabela
    if (outrasApostas.length === 0) {
        lista.innerHTML = '<tr><td class="p-4 text-center text-gray-400">Você é o único que apostou até agora!</td></tr>';
    } else {
        lista.innerHTML = 
            gerarSecao(`Vitória ${nomeA}`, grupos.vitoriaA) +
            gerarSecao(`Vitória ${nomeB}`, grupos.vitoriaB) +
            gerarSecao('Empate', grupos.empate);
    }
}

function abrirModalMensagem(titulo, texto) {
    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-texto').innerHTML = texto; 
    document.getElementById('modal-mensagem').classList.remove('hidden');
    document.body.classList.add('modal-aberto');
}

function verificarCardsExpirados() {
    const todosOsCards = document.querySelectorAll('.card-jogo');
    if (todosOsCards.length === 0) {
        console.log("Ainda não há cards para congelar.");
        return;
    }
    const agora = Date.now();
    const margemSeguranca = 60 * 60 * 1000;

    todosOsCards.forEach(card => {
        console.log("congelou card");
        const dataJogoStr = card.dataset.dataJogo;
        if (!dataJogoStr) return;

        const dataJogo = new Date(dataJogoStr).getTime();

        if (agora + margemSeguranca >= dataJogo) {
            const btnSalvar = card.querySelector('.btn-salvar');
            if (btnSalvar && !btnSalvar.classList.contains('hidden')) {
                console.log("Auto-congelando card do jogo:", card.dataset.jogoId);
                congelarCard(card, "Apostas Encerradas! Aguardando resultado");
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    verificarCardsExpirados();
    setInterval(verificarCardsExpirados, 60000);
});

function congelarCard(card, mensagemStatus) {
    const inputA = card.querySelector('.input-a');
    const inputB = card.querySelector('.input-b');
    const btnSalvar = card.querySelector('.btn-salvar');
    const statusBadge = card.querySelector('.status-badge');
    const definitivoA = card.querySelector('.definitivo-a');
    const definitivoB = card.querySelector('.definitivo-b');
    const containerPenaltis = card.querySelector('.container-penaltis');

    const btnVerApostas = card.querySelector('.ver-apostas');

    const valorA = inputA.dataset.valorOriginal || "";
    const valorB = inputB.dataset.valorOriginal || "";

    inputA.classList.add('hidden');
    inputB.classList.add('hidden');
    definitivoA.classList.remove('hidden');
    definitivoB.classList.remove('hidden');

    definitivoA.textContent = valorA;
    definitivoB.textContent = valorB;
    
    if (containerPenaltis) {
        containerPenaltis.classList.add('hidden');
    }
    
    btnSalvar.classList.add('hidden');
    
    if (statusBadge) {
        statusBadge.classList.remove('hidden');
        statusBadge.innerText = mensagemStatus;
    }

    if (btnVerApostas) {
        btnVerApostas.classList.remove('hidden');
        const jogoId = card.dataset.jogoId;
        const nomeTimeA = card.querySelector('.time-a').innerText;
        const nomeTimeB = card.querySelector('.time-b').innerText;
        btnVerApostas.onclick = () => abrirModal(jogoId, nomeTimeA, nomeTimeB);
    }
}

function fecharModal() {
    document.body.classList.remove('modal-aberto');
    document.getElementById('modal-apostas').classList.add('hidden');
}

function rolarParaUltimoResultado() {
    const ultimo = document.getElementById('ultimo-placar-oficial');
    if (!ultimo) return;

    const posicaoTopo = ultimo.getBoundingClientRect().top + window.scrollY;
    
    const margemNavbar = 120; 

    window.scrollTo({
        top: posicaoTopo - margemNavbar,
        behavior: 'smooth'
    });
}

function configurarBandeira(card, seletor, time) {
    const imgElement = card.querySelector(seletor);
    if (time?.id) {
        imgElement.src = `./assets/images/paises/${time.id}.svg`;
        imgElement.setAttribute("title", time.nome);
        imgElement.classList.remove("opacity-0"); // Garante que reaparece se o dado voltar
    } else {
        imgElement.classList.add("opacity-0");
        imgElement.src = ""; // Boa prática limpar o src antigo
    }
}

// document.addEventListener("visibilitychange", () => {
//     if (document.visibilityState === "visible") {
//         verificarJogosExpirados();
//     }
// });

// async function verificarJogosExpirados() {
//     const { data: jogos } = await supabaseClient.from('jogos').select('id, data_jogo');
    
//     jogos.forEach(jogo => {
//         if (new Date() >= new Date(jogo.data_jogo)) {
//             const inputs = document.querySelectorAll(`[data-jogo-id="${jogo.id}"]`);
//             inputs.forEach(input => input.disabled = true);
//             console.log(`Jogo ${jogo.id} bloqueado por expiração.`);
//         }
//     });
// }

// btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });

btnsLogout.forEach(botao => {
    botao.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.href = "index.html"; 
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificação de segurança: a modal existe nesta página?
    const modalChaveamento = document.getElementById('modal-chaveamento');
    if (!modalChaveamento) return; // Se não existe, para o script aqui e não faz nada!

    // Agora o restante do código só roda se a modal existir:
    const brackets = ['bracket-1', 'bracket-2', 'bracket-3', 'bracket-4', 'bracket-finais'];
    const botoes = ['abre-bracket-1', 'abre-bracket-2', 'abre-bracket-3', 'abre-bracket-4', 'abre-bracket-finais'];

    function trocarBracket(idAlvo) {
        // 1. Esconder todos os brackets
        brackets.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // 2. Resetar estilo de todos os botões (voltar para a cor padrão)
        botoes.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                // Remove as classes de "ativo" (ajuste conforme seu CSS real)
                btn.classList.remove('bg-emerald-400');
                btn.classList.add('bg-emerald-700/75');
            }
        });

        // 3. Mostrar o bracket alvo
        const bracketAlvo = document.getElementById(idAlvo.replace('abre-', ''));
        if (bracketAlvo) bracketAlvo.classList.remove('hidden');

        // 4. Marcar o botão clicado como ativo
        const btnClicado = document.getElementById(idAlvo);
        if (btnClicado) {
            btnClicado.classList.remove('bg-emerald-700/75');
            btnClicado.classList.add('bg-emerald-400');
        }
    }

    // 2. Eventos com verificação individual
    botoes.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => trocarBracket(id));
        }
    });

    document.getElementById('btn-fechar-chaveamento')?.addEventListener('click', () => {
        modalChaveamento.classList.add('hidden');
    });
});

// 1. Adicione a função no final do arquivo (ou onde preferir)
function popularChaveamento(jogos, ehPaginaFinais) {

    if (!ehPaginaFinais) return;

    document.querySelectorAll('[id^="match-"]').forEach(matchElement => {
        const matchId = matchElement.id.replace('match-', '');
        const jogo = jogos.find(j => String(j.jogo_fifa) === String(matchId));

        if (jogo) {
            const atualizarTime = (seletor, paisId) => {
                const container = matchElement.querySelector(seletor);
                if (!container) return;
                const img = container.querySelector('img');
                const span = container.querySelector('span');

                if (paisId) {
                    img.src = `./assets/images/paises/${paisId}.svg`;
                    img.classList.remove('hidden');
                    span.classList.add('hidden');
                } else {
                    img.classList.add('hidden');
                    span.classList.remove('hidden');
                }
            };
            atualizarTime('.time-a', jogo.time_a_id);
            atualizarTime('.time-b', jogo.time_b_id);
        }
    });
}

document.getElementById('modal-apostas').addEventListener('click', (e) => {
    // Se o elemento clicado for o fundo (e não o conteúdo interno), fecha
    if (e.target.id === 'modal-apostas') {
        fecharModal();
    }
});

// document.addEventListener('DOMContentLoaded', verificarSessao);
document.addEventListener('DOMContentLoaded', () => {
    carregarSaudacao();
    verificarSessao();
});

document.getElementById('btn-fechar-modal').addEventListener('click', fecharModal);
window.fecharModal = fecharModal;

document.getElementById('btn-fechar-mensagem').addEventListener('click', () => {
    document.getElementById('modal-mensagem').classList.add('hidden');
    document.body.classList.remove('modal-aberto');
});

document.getElementById('btn-refresh').addEventListener('click', () => {
    window.location.reload();
});

const btnFecharChaveamento = document.getElementById('btn-fechar-chaveamento');
const modalChaveamento = document.getElementById('modal-chaveamento');
const btnChaveamento = document.getElementById('btn-chaveamento');

if(btnFecharChaveamento && modalChaveamento && btnChaveamento) {

    btnFecharChaveamento.addEventListener('click', () => {
        document.body.classList.remove('modal-aberto');
        modalChaveamento.classList.add('hidden');
    });

    modalChaveamento.addEventListener('click', (e) => {
        // Se o elemento clicado for o fundo (e não o conteúdo interno), fecha
        if (e.target.id === 'modal-chaveamento') {
            document.body.classList.remove('modal-aberto');
            modalChaveamento.classList.add('hidden');
        }
    });

    btnChaveamento.addEventListener('click', () => {
        document.body.classList.add('modal-aberto');
        modalChaveamento.classList.remove('hidden');
    });

}
