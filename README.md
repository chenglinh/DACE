# DACE: Dense Flow from Adaptive Correspondence

**NeurIPS 2026**

[Cheng-Lin Hsieh](https://chenglinh.github.io/) · [Stella X. Yu](https://web.eecs.umich.edu/~stellayu/)
<br>University of Michigan

[Project page](https://chenglinh.github.io/DACE/) · [Paper](https://chenglinh.github.io/papers/dense-flow-adaptive-correspondence.pdf) · arXiv (coming soon)

[![DACE: Dense Flow from Adaptive Correspondence](https://chenglinh.github.io/DACE/static/img/social.jpg)](https://chenglinh.github.io/DACE/)

DACE learns which pixels to match together. It groups pixels into adaptive tokens, matches the tokens across frames,
and passes their motion back to every pixel. The flow is sharper at motion boundaries and more robust where no match
is visible. DACE has the lowest zero-shot Sintel Final and KITTI endpoint error among published methods.

## Code and checkpoints: coming soon

We will release here:

- [ ] Training and evaluation code
- [ ] Pretrained checkpoints

Star or watch this repository to be notified when they are available.

DACE uses a [DINOv3](https://github.com/facebookresearch/dinov3) backbone, whose weights are subject to the DINOv3
license.

## Citation

```bibtex
@inproceedings{hsieh2026dace,
  title     = {Dense Flow from Adaptive Correspondence},
  author    = {Hsieh, Cheng-Lin and Yu, Stella X.},
  booktitle = {Advances in Neural Information Processing Systems (NeurIPS)},
  year      = {2026}
}
```

## Acknowledgements

This project was supported in part by NSF grant 2313151, with additional computing resources provided through NAIRR
Pilot CIS240421 and CIS240431. We thank [SpixelFCN](https://github.com/fuy34/superpixel_fcn) and
[WAFT](https://github.com/princeton-vl/WAFT) for sharing their code.

## License

BSD 3-Clause. See [LICENSE](LICENSE).
