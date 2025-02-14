document.getElementById('search-form').addEventListener('submit', function (e) {
    e.preventDefault(); // Impede o envio padrão do formulário

    const codigoAcompanhamento = document.getElementById('codigo_acompanhamento').value;
    const nomeCliente = document.getElementById('nome').value;
    const resultContent = document.getElementById('result-content');

    // Limpa o conteúdo anterior
    resultContent.innerHTML = '<p>Carregando...</p>';

    // Faz a requisição ao servidor
    fetch(`/servicos?codigo_acompanhamento=${codigoAcompanhamento}&nome=${nomeCliente}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                // Exibe os dados encontrados
                const servico = data[0];
                resultContent.innerHTML = `
                    <p><strong>Nome:</strong> ${servico.nome}</p>
                    <p><strong>Equipamento:</strong> ${servico.computador}</p>
                    <p><strong>Problema:</strong> ${servico.problema}</p>
                    <p><strong>Status:</strong> ${servico.status}</p>
                    <p><strong>Data Prevista:</strong> ${servico.data_prevista || 'Não definida'}</p>
                    <p><strong>Valor Estimado:</strong> ${servico.valor_estimado ? `R$ ${servico.valor_estimado}` : 'Não informado'}</p>
                    <p><strong>Peças Utilizadas:</strong> ${servico.pecas_utilizadas || 'Nenhuma'}</p>
                    ${servico.imagem ? `<img src="data:image/jpeg;base64,${servico.imagem.toString('base64')}" alt="Imagem do serviço" style="max-width: 100%;">` : '<p>Nenhuma imagem disponível.</p>'}
                `;
            } else {
                // Exibe mensagem se não houver resultados
                resultContent.innerHTML = '<p>Nada registrado.</p>';
            }
        })
        .catch(error => {
            console.error('Erro ao buscar dados:', error);
            resultContent.innerHTML = '<p>Erro ao buscar dados. Tente novamente.</p>';
        });
});