import { remoteData } from "api/remoteData";
import client from "api/diseasexpressClientInstance";
import { computed, observable, action } from "mobx";
import * as _ from 'lodash';
import { GeneData, RsemGene, SampleData } from "api/generated/deAPI";
import jStat from 'jStat';
import { GlobalStores } from "shared/components/global/GlobalStores";

export enum ChartType {
   BOX     = 'box',
   SCATTER = 'scatter'
}

export type NormalizationType = "rsem" | "sample_abundance" | "sample_rsem_isoform";

export interface Normalization {
	label: string;
	value: NormalizationType;
}

export const NORMALIZATIONS: Normalization[] = [{
	label: "RSEM FPKM",
	value: "rsem"
}]


export type SelectOption  = { value: string; label: string }

export class QueryStore {

	public globalStores: GlobalStores;

	@observable chartType:ChartType = ChartType.BOX;

	@observable isValidated = false;

	@observable parameters: {
		geneY: string,
		geneX?: string,
		studies: string[],
		normalization: Normalization
	} = {} as any
	previousLoadedKey: string

	@action handleSubmit(queryParams: {
		geneY: string,
		geneX?: string,
		studies: string[],
		normalization: Normalization
	}) {
		this.isValidated = true
		this.parameters = queryParams;
	}

	readonly geneRemoteData = remoteData({
		invoke: () => {
			if (this.isValidated &&
				this.parameters &&
				this.parameters.geneY &&
				this.parameters.normalization &&
				this.parameters.studies) {
				let geneSymbols = [this.parameters.geneY]
				if(this.parameters.geneX){
					geneSymbols.push(this.parameters.geneX)
				}
				let data = {
					geneSymbols: geneSymbols.join(','),
					studies: this.parameters.studies.join(','),
					normalizations: [this.parameters.normalization.value]
				}
				return client.getDataByGeneSymbolsAndStudiesAndNormalizations(data)
			}
			else
				return Promise.resolve([]);
		}
	}, []);

	readonly geneData = remoteData<{ [sampleId: string]: { [id: string]: any } }>({
		await: ()=>[this.geneRemoteData,this.globalStores.samples],
		invoke: async () => {
			let samplesData: { [id: string]: any }[] = [];
			let samplesDataSet: { [sampleId: string]: any } = {};
			let inputData = this.geneRemoteData.result
			
			if(this.geneRemoteData.result.length>0){
				let sampleSet = this.globalStores.samplesSet
				inputData.forEach(obj => {
					obj.data.forEach(sampleObj => {
						let sampleData = samplesDataSet[sampleObj.sample_id]
						if(!sampleData){
							sampleData = sampleSet[sampleObj.sample_id];
						}
						if (sampleData &&
							sampleData['definition'] &&
							sampleData['definition'] !== "Solid Tissue Normal" &&
							sampleObj.rsem &&
							!_.isUndefined(sampleObj.rsem.fpkm)) {
							sampleData[obj.gene_symbol] = sampleObj.rsem.fpkm;
							samplesDataSet[sampleObj.sample_id] = sampleData
						}
					});
				});
			}
			return samplesDataSet;
		}
	}, {});

	@computed get studiesOption() {
		return this.globalStores.studies.result.map(study => {
			return {
				label: study,
				value: study
			};
		});
	}
	
}