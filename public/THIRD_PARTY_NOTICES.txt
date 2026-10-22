# Third-party notices

FILTA's topic model (`src/core/rules/topic-model.txt`) is a set of numeric word weights learned from the public datasets below. The datasets themselves are not included in FILTA or in this repository, and the model cannot reproduce their text. Training code: `scripts/topic-model/`.

## News Category Dataset (HuffPost)

- Rishabh Misra. *News Category Dataset*. arXiv:2209.11429, 2022. https://arxiv.org/abs/2209.11429
- Rishabh Misra and Jigyasa Grover. *Sculpting Data for ML: The First Act of Machine Learning*. 2021.
- Version 3: headlines and short descriptions from HuffPost, 2012–2022 (January–May 2018 held out for evaluation).
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0), as listed on the dataset's Kaggle page (kaggle.com/datasets/rmisra/news-category-dataset). https://creativecommons.org/licenses/by/4.0/
- Changes: the text was lower-cased and split into words and word pairs, then used only to fit model weights.

## AG News

- AG's corpus of news articles, collected by Antonio Gulli. http://groups.di.unipi.it/~gulli/AG_corpus_of_news_articles.html
- Topic classification subset: Xiang Zhang, Junbo Zhao and Yann LeCun. *Character-level Convolutional Networks for Text Classification*. Advances in Neural Information Processing Systems 28 (NIPS 2015).
- Terms: "provided by the academic community for research purposes in data mining … information retrieval … and any other non-commercial activity."
- **Before any commercial or paid release, confirm these terms or retrain without AG News** (`python3 scripts/topic-model/train.py` on HuffPost rows only).

## BBC News dataset (evaluation only)

D. Greene and P. Cunningham, *Practical Solutions to the Problem of Diagonal Dominance in Kernel Document Clustering*, ICML 2006. All rights in the original articles belong to the BBC. It was used only to measure accuracy and contributed nothing to the shipped model.
